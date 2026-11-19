# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.query_builder import Case
from frappe.query_builder.functions import Avg, Count, NullIf, Sum
from frappe.utils import cint, flt

from lms.lms.feedback import LATEST_COMMENTS, is_low_rating
from lms.lms.html_sanitizer import to_plain_text


class LMSCourseReview(Document):
	def validate(self):
		# A review is plain text: the app shows it as text, and the testimonials web
		# template prints it into a page.
		self.review = to_plain_text(self.review)
		self.validate_enrollment()
		self.validate_if_already_reviewed()

	def validate_enrollment(self):
		enrollment = frappe.db.exists("LMS Enrollment", {"course": self.course, "member": self.owner})
		if not enrollment:
			frappe.throw(_("You must be enrolled in the course to submit a review"))

	def validate_if_already_reviewed(self):
		# Checked on update too, so a review can't be moved onto a course its owner
		# already reviewed. The row itself is left out so it can still be edited.
		if frappe.db.exists(
			"LMS Course Review",
			{"course": self.course, "owner": self.owner, "name": ("!=", self.name)},
		):
			frappe.throw(_("You have already reviewed this course"))


def course_review_summary(course: str) -> dict:
	"""The average rating, the low-rated count and the latest reviews of a course.
	The caller checks access, as get_course_dashboard_stats does."""
	review = frappe.qb.DocType("LMS Course Review")
	totals = (
		frappe.qb.from_(review)
		.select(
			Count("*").as_("responses"),
			Sum(Case().when(is_low_rating(review.rating), 1).else_(0)).as_("low_responses"),
			Avg(NullIf(review.rating, 0)).as_("average"),
		)
		.where(review.course == course)
		.run(as_dict=True)[0]
	)

	return {
		"responses": cint(totals.responses),
		"low_responses": cint(totals.low_responses),
		"average": flt(flt(totals.average) * 5, 1),
		"latest": course_review_rows(course, start=0, page_length=LATEST_COMMENTS),
	}


def course_review_rows(course: str, *, low_only: bool = False, start: int, page_length: int) -> list:
	"""A page of a course's reviews, newest first; every row when `page_length` is 0."""
	review = frappe.qb.DocType("LMS Course Review")
	user = frappe.qb.DocType("User")
	query = (
		frappe.qb.from_(review)
		.left_join(user)
		.on(user.name == review.owner)
		.select(
			review.name,
			user.full_name.as_("member_name"),
			user.user_image.as_("member_image"),
			review.review.as_("feedback"),
			review.rating,
			review.creation,
		)
		.where(review.course == course)
		.orderby(review.creation, order=frappe.qb.desc)
		.orderby(review.name, order=frappe.qb.desc)
	)
	if low_only:
		query = query.where(is_low_rating(review.rating))
	if page_length:
		query = query.limit(page_length).offset(start)

	# `owner` is the student's login email; nothing here returns it.
	rows = query.run(as_dict=True)
	for row in rows:
		row.member_name = row.member_name or _("Unknown student")
		# One decimal, not whole stars: stored ratings can hold half a star.
		row.rating = flt(flt(row.rating) * 5, 1)
	return rows
