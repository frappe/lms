# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from contextlib import contextmanager

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import ceil


class LMSEnrollment(Document):
	def before_insert(self):
		self.validate_duplicate_enrollment()
		self.validate_course_enrollment_eligibility()
		self.validate_owner()

	def validate_owner(self):
		"""Makes the member as the owner of the document so that users can update their progress"""
		if self.owner != self.member:
			self.owner = self.member

	def on_update(self):
		update_program_progress(self.member)

	def validate_duplicate_enrollment(self):
		existing_enrollment = frappe.db.exists(
			"LMS Enrollment",
			{
				"course": self.course,
				"member": self.member,
				"name": ["!=", self.name],
			},
		)

		if existing_enrollment and existing_enrollment != self.name:
			frappe.throw(_("Student is already enrolled in this course."))

	def validate_course_enrollment_eligibility(self):
		course_details = frappe.db.get_value(
			"LMS Course",
			self.course,
			["published", "disable_self_learning", "paid_course", "paid_certificate"],
			as_dict=True,
		)

		if course_details.disable_self_learning and not is_admin():
			frappe.throw(
				_(
					"You cannot enroll in this course as self-learning is disabled. Please contact the Administrator."
				)
			)

		if self.enrollment_from_batch:
			if not frappe.db.exists(
				"Batch Course", {"parent": self.enrollment_from_batch, "course": self.course}
			):
				frappe.throw(_("This batch is not associated with this course."))

			if frappe.db.exists(
				"LMS Batch Enrollment", {"batch": self.enrollment_from_batch, "member": self.member}
			):
				return

		if not course_details.published and not is_admin():
			frappe.throw(_("You cannot enroll in an unpublished course."))

		if course_details.paid_course and not is_admin():
			payment = frappe.db.exists(
				"LMS Payment",
				{
					"payment_for_document_type": "LMS Course",
					"payment_for_document": self.course,
					"member": self.member,
					"payment_received": True,
				},
			)

			if not payment:
				frappe.throw(_("You need to complete the payment for this course before enrolling."))


def is_admin():
	roles = frappe.get_roles(frappe.session.user)
	admin_roles = ["Moderator", "Course Creator", "Batch Evaluator"]
	for role in admin_roles:
		if role in roles:
			return True
	return False


def update_program_progress(member):
	programs = frappe.get_all("LMS Program Member", {"member": member}, ["parent", "name"])

	for program in programs:
		total_progress = 0
		courses = frappe.get_all("LMS Program Course", {"parent": program.parent}, pluck="course")
		if not courses:
			continue

		for course in courses:
			progress = frappe.db.get_value("LMS Enrollment", {"course": course, "member": member}, "progress")
			progress = progress or 0
			total_progress += progress

		average_progress = ceil(total_progress / len(courses))
		frappe.db.set_value("LMS Program Member", program.name, "progress", average_progress)


@contextmanager
def batched_enrollment_updates():
	"""Coalesce every enrollment write in this block into one write and one dispatch."""
	# A lesson completion writes the enrollment twice: LMS Course Progress.on_update
	# recalculates progress, then save_progress advances current_lesson. Dispatched
	# separately that is two on_updates — two webhook deliveries per completion, where
	# the pre-regression .save() delivered one. Batching restores the single event.
	if getattr(frappe.local, "lms_enrollment_batch", None) is not None:
		yield
		return

	frappe.local.lms_enrollment_batch = {}
	try:
		yield
		batch = frappe.local.lms_enrollment_batch
	finally:
		frappe.local.lms_enrollment_batch = None

	# One enrollment's on_update handler must not strand the rest of the batch unwritten.
	failed = []
	for name, values in batch.items():
		try:
			_write_enrollment(name, values)
		except Exception:
			frappe.log_error(title=f"Enrollment update failed: {name}")
			failed.append(name)

	if failed:
		frappe.throw(_("Could not update enrollments: {0}").format(", ".join(failed)))


def update_enrollment(name: str, values: dict):
	"""Write enrollment fields, firing the save doc events a raw set_value would skip."""
	batch = getattr(frappe.local, "lms_enrollment_batch", None)
	if batch is not None:
		batch.setdefault(name, {}).update(values)
		return

	_write_enrollment(name, values)


def _write_enrollment(name: str, values: dict):
	# Do not turn this back into enrollment.save(). Two near-simultaneous requests
	# (video-ended fires markProgress + trackVideoWatchDuration, which also writes
	# progress) raced there: both .save()s ran check_if_latest() and the second threw
	# TimestampMismatchError, swallowing whichever write arrived second. A raw
	# set_value skips that guard but fires no doc events at all, which is what
	# silently broke On Update webhooks / DocType Event scripts. So: write raw, then
	# dispatch on_update and on_change by hand, in the order .save() would.
	enrollment = frappe.get_doc("LMS Enrollment", name)
	for field in values:
		if not enrollment.meta.get_field(field):
			frappe.throw(_("{0} is not a field on LMS Enrollment").format(field))

	changed = {field: value for field, value in values.items() if enrollment.get(field) != value}
	if not changed:
		return

	# on_change handlers and Value Change notifications read doc_before_save. Rebuild
	# the snapshot from the values we already hold: load_doc_before_save() re-reads the
	# row FOR UPDATE (the lock this write exists to avoid), and a deepcopy would clone
	# the process-cached DocMeta along with it.
	enrollment._doc_before_save = frappe.get_doc(enrollment.as_dict())

	frappe.db.set_value("LMS Enrollment", name, changed, update_modified=False)
	enrollment.update(changed)
	enrollment.run_method("on_update")
	enrollment.run_method("on_change")
