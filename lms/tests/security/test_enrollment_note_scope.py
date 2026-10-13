# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import frappe
from frappe.utils import add_days, nowdate

from lms.lms.test_helpers import BaseTestUtils


class TestEnrollmentAndNoteScope(BaseTestUtils):
	"""An enrolment belongs to its learner, the authors of its course and the
	instructors of the batch it came from; a lesson note to its learner alone.
	Course Creators are staff of the courses they teach, not of every course."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.author = cls._create_user(f"esauth-{hash}@example.com", "Ann", "Author", ["Course Creator"])
		cls.outsider = cls._create_user(f"esout-{hash}@example.com", "Otto", "Outside", ["Course Creator"])
		cls.batch_teacher = cls._create_user(
			f"esbatch-{hash}@example.com", "Bea", "Batch", ["Course Creator"]
		)
		cls.moderator = cls._create_user(f"esmod-{hash}@example.com", "Mo", "Derator", ["Moderator"])
		cls.learner = cls._create_user(f"eslrn-{hash}@example.com", "Lee", "Learner", ["LMS Student"])

		cls.course = cls._create_course(title=f"Scope Course {hash}", instructor=cls.author.name)
		chapter = cls._create_chapter(f"Scope Chapter {hash}", cls.course.name)
		cls.lesson = cls._create_lesson(f"Scope Lesson {hash}", chapter.name, cls.course.name)
		cls.enrollment = cls._create_enrollment(cls.learner.name, cls.course.name)
		cls.note = frappe.get_doc(
			{
				"doctype": "LMS Lesson Note",
				"lesson": cls.lesson.name,
				"course": cls.course.name,
				"member": cls.learner.name,
				"note": "My private note",
			}
		).insert(ignore_permissions=True)
		# Learners write their own notes, so they own them.
		frappe.db.set_value("LMS Lesson Note", cls.note.name, "owner", cls.learner.name)

		# Paid and unpublished, owned by the author. Set directly: the paid flag's
		# validation needs the Payments app, which is beside the point here.
		cls.closed_course = cls._create_course(title=f"Closed Course {hash}", instructor=cls.author.name)
		frappe.db.set_value("LMS Course", cls.closed_course.name, {"paid_course": 1, "published": 0})

		cls.batch = frappe.get_doc(
			{
				"doctype": "LMS Batch",
				"title": f"Scope Batch {hash}",
				"start_date": nowdate(),
				"end_date": add_days(nowdate(), 10),
				"start_time": "09:00:00",
				"end_time": "11:00:00",
				"timezone": "Asia/Kolkata",
				"description": "Scope batch",
				"batch_details": "Scope batch",
				"instructors": [{"instructor": cls.batch_teacher.name}],
				"courses": [{"course": cls.course.name}],
			}
		).insert(ignore_permissions=True)
		frappe.db.set_value("LMS Enrollment", cls.enrollment.name, "enrollment_from_batch", cls.batch.name)

	def _as(self, user):
		frappe.set_user(user.name if hasattr(user, "name") else user)

	def _can(self, doctype, name, ptype):
		return frappe.has_permission(doctype, ptype, frappe.get_doc(doctype, name))

	def _listed(self, doctype, name):
		return name in frappe.get_list(doctype, pluck="name", limit_page_length=0)

	def test_a_course_creator_who_does_not_teach_the_course_is_shut_out(self):
		self._as(self.outsider)
		for doctype, name in (("LMS Enrollment", self.enrollment.name), ("LMS Lesson Note", self.note.name)):
			self.assertFalse(self._listed(doctype, name), doctype)
			for ptype in ("read", "write", "delete"):
				self.assertFalse(self._can(doctype, name, ptype), f"{doctype} {ptype}")

	def test_the_course_author_manages_enrolments_but_not_private_notes(self):
		self._as(self.author)
		self.assertTrue(self._listed("LMS Enrollment", self.enrollment.name))
		self.assertTrue(self._can("LMS Enrollment", self.enrollment.name, "write"))
		self.assertFalse(self._listed("LMS Lesson Note", self.note.name))
		self.assertFalse(self._can("LMS Lesson Note", self.note.name, "read"))

	def test_the_batch_instructor_manages_enrolments_from_their_batch(self):
		self._as(self.batch_teacher)
		self.assertTrue(self._listed("LMS Enrollment", self.enrollment.name))
		self.assertTrue(self._can("LMS Enrollment", self.enrollment.name, "write"))

	def test_the_learner_keeps_their_own_enrolment_and_notes(self):
		self._as(self.learner)
		self.assertTrue(self._listed("LMS Enrollment", self.enrollment.name))
		self.assertTrue(self._listed("LMS Lesson Note", self.note.name))
		self.assertTrue(self._can("LMS Lesson Note", self.note.name, "write"))

	def test_a_moderator_sees_everything(self):
		self._as(self.moderator)
		self.assertTrue(self._listed("LMS Enrollment", self.enrollment.name))
		self.assertTrue(self._listed("LMS Lesson Note", self.note.name))

	def test_a_course_creator_cannot_enrol_into_a_paid_unpublished_course_of_another(self):
		self._as(self.outsider)
		enrollment = frappe.get_doc(
			{"doctype": "LMS Enrollment", "course": self.closed_course.name, "member": self.outsider.name}
		)
		with self.assertRaises(frappe.ValidationError):
			enrollment.insert()

	def test_a_course_creator_cannot_set_their_own_progress_in_another_course(self):
		self._as(self.outsider)
		enrollment = frappe.get_doc(
			{"doctype": "LMS Enrollment", "course": self.course.name, "member": self.outsider.name}
		).insert()
		enrollment.progress = 100
		enrollment.purchased_certificate = 1
		enrollment.save()

		stored = frappe.db.get_value(
			"LMS Enrollment", enrollment.name, ["progress", "purchased_certificate"], as_dict=True
		)
		self.assertEqual((stored.progress, stored.purchased_certificate), (0, 0))

	def test_the_course_author_still_enrols_learners_into_their_closed_course(self):
		self._as(self.author)
		enrollment = frappe.get_doc(
			{
				"doctype": "LMS Enrollment",
				"course": self.closed_course.name,
				"member": self.learner.name,
				"purchased_certificate": 1,
			}
		).insert()
		self.assertEqual(frappe.db.get_value("LMS Enrollment", enrollment.name, "purchased_certificate"), 1)

	def _batch_with(self, course, instructor):
		return frappe.get_doc(
			{
				"doctype": "LMS Batch",
				"title": f"Own Batch {frappe.generate_hash(length=6)}",
				"start_date": nowdate(),
				"end_date": add_days(nowdate(), 10),
				"start_time": "09:00:00",
				"end_time": "11:00:00",
				"timezone": "Asia/Kolkata",
				"description": "Own batch",
				"batch_details": "Own batch",
				"instructors": [{"instructor": instructor.name}],
				"courses": [{"course": course}],
			}
		).insert(ignore_permissions=True)

	def test_naming_a_batch_one_teaches_does_not_open_a_closed_course(self):
		batch = self._batch_with(self.closed_course.name, self.outsider)
		self._as(self.outsider)
		enrollment = frappe.get_doc(
			{
				"doctype": "LMS Enrollment",
				"course": self.closed_course.name,
				"member": self.outsider.name,
				"enrollment_from_batch": batch.name,
				"purchased_certificate": 1,
			}
		)
		with self.assertRaises(frappe.ValidationError):
			enrollment.insert()

	def test_adding_a_learner_to_a_batch_enrols_them_in_its_closed_courses(self):
		batch = self._batch_with(self.closed_course.name, self.batch_teacher)
		newcomer = self._create_user(
			f"esnew-{frappe.generate_hash(length=6)}@example.com", "Nia", "New", ["LMS Student"]
		)
		self._as(self.batch_teacher)
		frappe.get_doc(
			{"doctype": "LMS Batch Enrollment", "batch": batch.name, "member": newcomer.name}
		).insert(ignore_permissions=True)
		self.assertTrue(
			frappe.db.exists("LMS Enrollment", {"course": self.closed_course.name, "member": newcomer.name})
		)
