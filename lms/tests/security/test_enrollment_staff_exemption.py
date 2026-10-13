# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""Who skips the eligibility and payment checks on course and batch enrollment."""

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestEnrollmentStaffExemption(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		suffix = frappe.generate_hash(length=6)
		cls.instructor = cls._ese_user(suffix, "ins", ["Course Creator"])
		cls.creator = cls._ese_user(suffix, "cc", ["Course Creator"])
		cls.evaluator = cls._ese_user(suffix, "ev", ["LMS Student", "Batch Evaluator"])
		cls.batch_staff = cls._ese_user(suffix, "bs", ["Course Creator", "Batch Evaluator"])
		cls.moderator = cls._ese_user(suffix, "mod", ["Moderator"])
		cls.student = cls._ese_user(suffix, "stu", ["LMS Student"])
		cls.other_student = cls._ese_user(suffix, "stu2", ["LMS Student"])
		cls._create_evaluator(cls.batch_staff.email)

		cls.courses = {}
		for state in ("paid_course", "unpublished", "disable_self_learning"):
			course = cls._create_course(f"ESE {state} {suffix}", cls.instructor.email).name
			cls.courses[state] = course
		frappe.db.set_value(
			"LMS Course",
			cls.courses["paid_course"],
			{"paid_course": 1, "course_price": 100, "currency": "INR"},
		)
		frappe.db.set_value("LMS Course", cls.courses["unpublished"], "published", 0)
		frappe.db.set_value("LMS Course", cls.courses["disable_self_learning"], "disable_self_learning", 1)

		free_course = cls._create_course(f"ESE free {suffix}", cls.instructor.email).name
		cls.restricted_batch = cls._create_batch(
			free_course, cls.batch_staff.email, f"ESE restricted {suffix}", cls.batch_staff.email
		).name
		cls.paid_course_batch = cls._create_batch(
			cls.courses["paid_course"],
			cls.batch_staff.email,
			f"ESE paid course {suffix}",
			cls.batch_staff.email,
		).name
		all_courses_batch = cls._create_batch(
			cls.courses["paid_course"],
			cls.batch_staff.email,
			f"ESE all courses {suffix}",
			cls.batch_staff.email,
		)
		for state in ("unpublished", "disable_self_learning"):
			all_courses_batch.append(
				"courses", {"course": cls.courses[state], "evaluator": cls.batch_staff.email}
			)
		all_courses_batch.save()
		cls.all_courses_batch = all_courses_batch.name

	@classmethod
	def _ese_user(cls, suffix, prefix, roles):
		return cls._create_user(f"ese-{prefix}-{suffix}@example.com", "ESE", prefix, roles)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _enroll_in_course(self, user, course):
		frappe.set_user(user)
		doc = frappe.new_doc("LMS Enrollment")
		doc.update({"member": user, "course": course})
		doc.insert()
		return doc

	def _enroll_in_batch(self, member, batch, owner=None):
		frappe.set_user(owner or member)
		doc = frappe.new_doc("LMS Batch Enrollment")
		doc.update({"member": member, "batch": batch})
		doc.insert()
		return doc

	def test_unrelated_staff_roles_do_not_skip_course_checks(self):
		"""#1922 let any Course Creator or Batch Evaluator skip the paid, published and
		self-learning checks on every course. Added in this PR (ticket 78761)."""
		refusals = {
			"paid_course": "complete the payment",
			"unpublished": "unpublished course",
			"disable_self_learning": "self-learning is disabled",
		}
		for user in (self.creator, self.evaluator):
			for state, refusal in refusals.items():
				with self.subTest(user=user.email, state=state):
					with self.assertRaisesRegex(frappe.ValidationError, refusal):
						self._enroll_in_course(user.email, self.courses[state])

	def test_course_instructor_and_moderator_skip_course_checks(self):
		"""Narrowing #1922's role list must keep the course's own staff exempt. Added in this PR."""
		for user in (self.instructor, self.moderator):
			for state, course in self.courses.items():
				with self.subTest(user=user.email, state=state):
					self.assertEqual(self._enroll_in_course(user.email, course).member, user.email)

	def test_unrelated_staff_roles_cannot_self_enroll_in_restricted_batch(self):
		"""#1937 let any Course Creator or Batch Evaluator self-enroll in a batch closed
		to self-enrollment. Added in this PR (ticket 78761)."""
		for user in (self.creator, self.evaluator):
			with self.subTest(user=user.email):
				with self.assertRaisesRegex(frappe.ValidationError, "restricted"):
					self._enroll_in_batch(user.email, self.restricted_batch)

	def test_batch_staff_self_enroll_in_restricted_batch(self):
		"""Narrowing #1937's role list must keep the batch's tagged staff exempt. Added in this PR."""
		doc = self._enroll_in_batch(self.batch_staff.email, self.restricted_batch)
		self.assertEqual(doc.member, self.batch_staff.email)

	def test_batch_evaluator_enrolls_others_through_a_batch(self):
		"""Enrolling someone else stays with validate_owner, and the batch's course rows
		must not refuse its paid course. Added in this PR."""
		for batch in (self.restricted_batch, self.paid_course_batch):
			with self.subTest(batch=batch):
				doc = self._enroll_in_batch(self.student.email, batch, owner=self.evaluator.email)
				self.assertEqual(doc.member, self.student.email)

	def test_client_cannot_enroll_another_member(self):
		frappe.set_user(self.student.email)
		with self.assertRaises(frappe.PermissionError):
			frappe.client.insert(
				{
					"doctype": "LMS Enrollment",
					"member": self.other_student.email,
					"course": self.courses["paid_course"],
					"enrollment_from_batch": self.all_courses_batch,
				}
			)

	def test_client_flags_cannot_skip_course_checks(self):
		"""via_batch_enrollment is set only by the server; a client insert carrying it still gets the course checks."""
		refusals = {
			"paid_course": "complete the payment",
			"unpublished": "unpublished course",
			"disable_self_learning": "self-learning is disabled",
		}
		frappe.set_user(self.student.email)
		for state, refusal in refusals.items():
			with self.subTest(state=state):
				with self.assertRaisesRegex(frappe.ValidationError, refusal):
					frappe.client.insert(
						{
							"doctype": "LMS Enrollment",
							"member": self.student.email,
							"course": self.courses[state],
							"enrollment_from_batch": self.all_courses_batch,
							"flags": {"via_batch_enrollment": True},
						}
					)
