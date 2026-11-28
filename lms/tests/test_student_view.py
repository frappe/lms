import inspect
from unittest.mock import patch

import frappe

from lms.lms import student_view
from lms.lms.student_view import enroll_self, reset_own_progress
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import build_batch_details


class TestStudentView(BaseTestUtils):
	"""An instructor enrolls in their own course or batch and resets their own progress."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		suffix = frappe.generate_hash(length=6)
		cls.instructor = cls._create_user(f"sv-ins-{suffix}@example.com", "Ins", suffix, ["Course Creator"])
		cls.other_instructor = cls._create_user(
			f"sv-other-{suffix}@example.com", "Other", suffix, ["Course Creator"]
		)
		cls.learner = cls._create_user(f"sv-stu-{suffix}@example.com", "Stu", suffix, ["LMS Student"])
		cls._require_no_moderators(cls.instructor.name, cls.other_instructor.name, cls.learner.name)

		cls.course = cls._create_course(f"SV course {suffix}", cls.instructor.name).name
		cls._create_course(f"SV other course {suffix}", cls.other_instructor.name)
		cls.questions = cls._create_quiz_questions()
		cls.quiz = cls._create_quiz(cls.questions, f"SV quiz {suffix}")
		cls.assignment = cls._create_assignment(f"SV assignment {suffix}")
		cls.programming_exercise = cls._create_programming_exercise(f"SV exercise {suffix}")
		cls.lessons = [
			cls._place_in_lesson(cls.course, "LMS Quiz", cls.quiz.name).name,
			cls._place_in_lesson(cls.course, "LMS Assignment", cls.assignment.name).name,
			cls._place_in_lesson(cls.course, "LMS Programming Exercise", cls.programming_exercise.name).name,
		]

		cls._create_evaluator(cls.instructor.name)
		cls.batch = cls._create_batch(
			cls.course, cls.instructor.name, f"SV batch {suffix}", cls.instructor.name
		).name
		frappe.db.set_value("LMS Batch", cls.batch, {"paid_batch": 1, "amount": 100, "currency": "INR"})
		cls._create_enrollment(cls.learner.name, cls.course)

	def add_progress(self, member):
		frappe.set_user("Administrator")
		self._create_enrollment(member, self.course)
		self._create_lesson_progress(member, self.course, self.lessons[0])
		self._create_quiz_submission(member)
		self._create_assignment_submission(member)
		self._create_programming_exercise_submission(member)
		frappe.db.set_value("LMS Enrollment", {"course": self.course, "member": member}, "progress", 50)

	def count_progress(self, member):
		return {
			"progress": frappe.db.count("LMS Course Progress", {"member": member, "course": self.course}),
			"quiz": frappe.db.count("LMS Quiz Submission", {"member": member, "quiz": self.quiz.name}),
			"assignment": frappe.db.count(
				"LMS Assignment Submission", {"member": member, "assignment": self.assignment.name}
			),
			"exercise": frappe.db.count(
				"LMS Programming Exercise Submission",
				{"member": member, "exercise": self.programming_exercise.name},
			),
		}

	def test_learner_is_refused(self):
		frappe.set_user(self.learner.name)
		for endpoint in (enroll_self, reset_own_progress):
			for doctype, name in (("LMS Course", self.course), ("LMS Batch", self.batch)):
				with self.subTest(endpoint=endpoint.__name__, doctype=doctype):
					with self.assertRaises(frappe.PermissionError):
						endpoint(doctype, name)

	def test_another_courses_instructor_is_refused(self):
		frappe.set_user(self.other_instructor.name)
		for endpoint in (enroll_self, reset_own_progress):
			for doctype, name in (("LMS Course", self.course), ("LMS Batch", self.batch)):
				with self.subTest(endpoint=endpoint.__name__, doctype=doctype):
					with self.assertRaises(frappe.PermissionError):
						endpoint(doctype, name)
		self.assertFalse(frappe.db.exists("LMS Enrollment", {"member": self.other_instructor.name}))

	def test_other_doctypes_are_refused(self):
		frappe.set_user(self.instructor.name)
		with self.assertRaises(frappe.ValidationError):
			enroll_self("LMS Program", self.course)

	def test_endpoints_take_no_user_and_refuse_guests(self):
		for endpoint in (enroll_self, reset_own_progress):
			with self.subTest(endpoint=endpoint.__name__):
				self.assertEqual(list(inspect.signature(endpoint).parameters), ["doctype", "name"])
				self.assertNotIn(endpoint, frappe.guest_methods)
				self.assertEqual(tuple(frappe.allowed_http_methods_for_whitelisted_func[endpoint]), ("POST",))

		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			enroll_self("LMS Course", self.course)

	def test_instructor_enrolls_in_their_course_as_staff(self):
		enrollments_before = frappe.db.get_value("LMS Course", self.course, "enrollments")
		frappe.set_user(self.instructor.name)
		enroll_self("LMS Course", self.course)
		enroll_self("LMS Course", self.course)

		rows = frappe.get_all(
			"LMS Enrollment", {"course": self.course, "member": self.instructor.name}, ["member_type"]
		)
		self.assertEqual([row.member_type for row in rows], ["Staff"])
		self.assertEqual(frappe.db.get_value("LMS Course", self.course, "enrollments"), enrollments_before)

	def test_instructor_enrolls_in_their_paid_batch_and_its_courses(self):
		frappe.set_user(self.instructor.name)
		with patch(
			"lms.lms.doctype.lms_batch_enrollment.lms_batch_enrollment.send_confirmation_email"
		) as email:
			enroll_self("LMS Batch", self.batch)

		email.assert_not_called()
		self.assertTrue(
			frappe.db.exists("LMS Batch Enrollment", {"batch": self.batch, "member": self.instructor.name})
		)
		member_type = frappe.db.get_value(
			"LMS Enrollment", {"course": self.course, "member": self.instructor.name}, "member_type"
		)
		self.assertEqual(member_type, "Staff")

	def test_batch_preview_takes_no_seat(self):
		frappe.set_user("Administrator")
		frappe.db.set_value("LMS Batch", self.batch, "seat_count", 5)
		self.addCleanup(frappe.db.set_value, "LMS Batch", self.batch, "seat_count", 0)
		before = build_batch_details(self.batch)

		frappe.set_user(self.instructor.name)
		enroll_self("LMS Batch", self.batch)

		member_type = frappe.db.get_value(
			"LMS Batch Enrollment", {"batch": self.batch, "member": self.instructor.name}, "member_type"
		)
		self.assertEqual(member_type, "Staff")
		after = build_batch_details(self.batch)
		self.assertEqual(after.student_count, before.student_count)
		self.assertEqual(after.seats_left, before.seats_left)

	def test_batch_preview_works_when_the_batch_is_full(self):
		frappe.set_user("Administrator")
		batch = self._create_batch(
			self.course, self.instructor.name, f"SV full batch {self.learner.name}", self.instructor.name
		).name
		self._create_batch_enrollment(self.learner.name, batch)
		frappe.db.set_value("LMS Batch", batch, "seat_count", 1)

		frappe.set_user(self.instructor.name)
		enroll_self("LMS Batch", batch)

		self.assertTrue(
			frappe.db.exists("LMS Batch Enrollment", {"batch": batch, "member": self.instructor.name})
		)
		self.assertEqual(build_batch_details(batch).seats_left, 0)

	def test_learner_cannot_enroll_as_staff(self):
		frappe.set_user(self.learner.name)
		enrollment = frappe.new_doc("LMS Batch Enrollment")
		enrollment.update({"batch": self.batch, "member": self.learner.name, "member_type": "Staff"})
		with self.assertRaises(frappe.PermissionError):
			enrollment.insert()

	def test_reset_deletes_only_the_callers_course_progress(self):
		self.add_progress(self.instructor.name)
		self.add_progress(self.learner.name)
		learner_before = self.count_progress(self.learner.name)
		self.assertTrue(all(learner_before.values()))
		self.assertTrue(all(self.count_progress(self.instructor.name).values()))

		frappe.set_user(self.instructor.name)
		reset_own_progress("LMS Course", self.course)

		self.assertFalse(any(self.count_progress(self.instructor.name).values()))
		self.assertEqual(self.count_progress(self.learner.name), learner_before)
		enrollment = {"course": self.course, "member": self.instructor.name}
		self.assertEqual(frappe.db.get_value("LMS Enrollment", enrollment, "progress"), 0)
		learner_enrollment = {"course": self.course, "member": self.learner.name}
		self.assertEqual(frappe.db.get_value("LMS Enrollment", learner_enrollment, "progress"), 50)

	def test_batch_reset_covers_the_batch_courses(self):
		self.add_progress(self.instructor.name)
		self.add_progress(self.learner.name)
		learner_before = self.count_progress(self.learner.name)

		frappe.set_user(self.instructor.name)
		reset_own_progress("LMS Batch", self.batch)

		self.assertFalse(any(self.count_progress(self.instructor.name).values()))
		self.assertEqual(self.count_progress(self.learner.name), learner_before)

	def test_delete_rows_refuses_another_member(self):
		frappe.set_user(self.instructor.name)
		with self.assertRaises(frappe.PermissionError):
			student_view.delete_rows("LMS Course Progress", {"member": self.learner.name})
