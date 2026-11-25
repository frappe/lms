# Copyright (c) 2025, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.query_builder import Case
from frappe.query_builder.functions import Avg, Count, NullIf, Sum
from frappe.utils import cint, flt

from lms.lms.feedback import LATEST_COMMENTS, is_low_rating
from lms.lms.permissions import validate_filed_for_self

RATING_FIELDS = ("content", "instructors", "value")


class LMSBatchFeedback(Document):
	def validate(self):
		validate_filed_for_self(self, "member")
		self.validate_member_is_enrolled()

	def validate_member_is_enrolled(self):
		if not frappe.db.exists("LMS Batch Enrollment", {"batch": self.batch, "member": self.member}):
			frappe.throw(
				_("{0} is not enrolled in batch {1}, so cannot give feedback on it.").format(
					frappe.bold(self.member), frappe.bold(self.batch)
				),
				frappe.PermissionError,
				title=_("Not enrolled in batch"),
			)


def feedback_summary(batch: str) -> dict:
	"""Averages, the low-rated response count and the latest comments of a batch's
	feedback. The caller checks access, as get_batch_dashboard_stats does."""
	feedback = frappe.qb.DocType("LMS Batch Feedback")
	columns = [Count("*").as_("responses"), _low_response_count(feedback).as_("low_responses")]
	for field in RATING_FIELDS:
		columns.append(Avg(NullIf(feedback[field], 0)).as_(f"average_{field}"))

	totals = frappe.qb.from_(feedback).select(*columns).where(feedback.batch == batch).run(as_dict=True)[0]

	return {
		"responses": cint(totals.responses),
		"low_responses": cint(totals.low_responses),
		"averages": {field: flt(flt(totals[f"average_{field}"]) * 5, 1) for field in RATING_FIELDS},
		"latest": feedback_rows(batch, start=0, page_length=LATEST_COMMENTS),
	}


def feedback_rows(batch: str, *, low_only: bool = False, start: int, page_length: int) -> list:
	feedback = frappe.qb.DocType("LMS Batch Feedback")
	query = (
		frappe.qb.from_(feedback)
		.select(
			feedback.name,
			feedback.member_name,
			feedback.member_image,
			feedback.feedback,
			feedback.creation,
			*(feedback[field] for field in RATING_FIELDS),
		)
		.where(feedback.batch == batch)
		.orderby(feedback.creation, order=frappe.qb.desc)
		.orderby(feedback.name, order=frappe.qb.desc)
	)
	if low_only:
		query = query.where(_is_low_response(feedback))
	if page_length:
		query = query.limit(page_length).offset(start)

	# `member` is the student's login email; nothing here returns it.
	rows = query.run(as_dict=True)
	for row in rows:
		for field in RATING_FIELDS:
			row[field] = round(flt(row[field]) * 5)
	return rows


def _is_low_response(feedback):
	content, instructors, value = (is_low_rating(feedback[field]) for field in RATING_FIELDS)
	return content | instructors | value


def _low_response_count(feedback):
	return Sum(Case().when(_is_low_response(feedback), 1).else_(0))
