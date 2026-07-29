import importlib.util
import sys
import time

import frappe
from frappe.tests import UnitTestCase
from frappe.tests.utils import FrappeTestCase

from lms import raven_provider
from lms.raven_provider import (
	default_evaluator,
)


class TestOptionalRavenIntegrationImport(UnitTestCase):
	"""lms.raven_provider must import on a bench without the optional raven_integration app.

	Regression: a module-scope `from raven_integration.exceptions import ProviderDataError`
	made every test module that touches the provider error out on import. Schema-free, so
	UnitTestCase (IntegrationTestCase's record loader trips the Fiscal Year flake).
	"""

	def test_imports_without_raven_integration(self):
		blocked = ("raven_integration", "raven_integration.exceptions")
		saved = {name: sys.modules.get(name) for name in blocked}
		# A None entry in sys.modules makes the import machinery raise ImportError,
		# which is exactly what an uninstalled app looks like.
		for name in blocked:
			sys.modules[name] = None
		try:
			# Load a throwaway copy so the shared module object is never mutated.
			spec = importlib.util.spec_from_file_location(
				"lms_raven_provider_without_raven", raven_provider.__file__
			)
			module = importlib.util.module_from_spec(spec)
			spec.loader.exec_module(module)
		finally:
			for name, original in saved.items():
				if original is None:
					sys.modules.pop(name, None)
				else:
					sys.modules[name] = original

		self.assertTrue(issubclass(module.ProviderDataError, Exception))
		with self.assertRaises(module.ProviderDataError):
			module.default_evaluator({"rule_type": "No Such Rule"})


class TestAllEnrolledRule(FrappeTestCase):
	def setUp(self):
		self.enrolled = frappe.get_doc(
			{
				"doctype": "User",
				"email": "raven-test-enrolled@example.com",
				"first_name": "Enrolled",
				"send_welcome_email": 0,
			}
		).insert()
		self.unenrolled = frappe.get_doc(
			{
				"doctype": "User",
				"email": "raven-test-unenrolled@example.com",
				"first_name": "Unenrolled",
				"send_welcome_email": 0,
			}
		).insert()
		course = frappe.get_all("LMS Course", limit=1)
		if not course:
			self.skipTest("No course fixture; populate one before running this test")
		self.course = course[0].name
		self.enrollment = frappe.get_doc(
			{
				"doctype": "LMS Enrollment",
				"member": self.enrolled.name,
				"course": self.course,
			}
		).insert()
		# addCleanup is LIFO: enrolled/unenrolled must be added before enrollment
		# so enrollment is deleted first, then users.
		self.addCleanup(self.enrolled.delete)
		self.addCleanup(self.unenrolled.delete)
		self.addCleanup(self.enrollment.delete)

	def test_returns_enrolled_user(self):
		rule = {
			"rule_type": "All Enrolled Students",
			"payment_filter": "Any",
			"batches": [],
			"courses": [],
			"staff_role": None,
			"staff_scope_batches": [],
			"staff_scope_courses": [],
		}
		matched = default_evaluator(rule)
		self.assertIn(self.enrolled.name, matched)
		self.assertNotIn(self.unenrolled.name, matched)


class TestAllEnrolledIncludesBatchOnlyStudents(FrappeTestCase):
	"""'All Enrolled Students' must not drop students who only have a batch enrollment.

	LMS Batch Enrollment mirrors itself into one LMS Enrollment per Batch Course row, so a
	batch with no courses mirrors nothing. Membership sync is authoritative — an omission
	here removes a real student from the channel.
	"""

	def setUp(self):
		self.batch = frappe.get_doc(
			{
				"doctype": "LMS Batch",
				"title": "Raven Course-less Batch",
				"start_date": frappe.utils.today(),
				"end_date": frappe.utils.add_days(frappe.utils.today(), 7),
				"description": "Batch with no Batch Course rows",
				"batch_details": "Batch with no Batch Course rows",
				"start_time": "09:00:00",
				"end_time": "10:00:00",
				"timezone": "Asia/Kolkata",
				"instructors": [{"instructor": "Administrator"}],
			}
		).insert()
		self.addCleanup(lambda: frappe.delete_doc("LMS Batch", self.batch.name, force=True))

		self.batch_only = frappe.get_doc(
			{
				"doctype": "User",
				"email": "raven-batch-only@example.com",
				"first_name": "BatchOnly",
				"send_welcome_email": 0,
			}
		).insert()
		self.addCleanup(lambda: frappe.delete_doc("User", self.batch_only.name, force=True))

		enrollment = frappe.get_doc(
			{"doctype": "LMS Batch Enrollment", "member": self.batch_only.name, "batch": self.batch.name}
		).insert()
		self.enrollment = enrollment
		self.addCleanup(lambda: frappe.delete_doc("LMS Batch Enrollment", enrollment.name, force=True))

	def _matched(self, payment_filter: str = "Any") -> set:
		return default_evaluator({"rule_type": "All Enrolled Students", "payment_filter": payment_filter})

	def test_batch_only_student_is_enrolled(self):
		# The mirror never ran (no Batch Course rows) — prove it, so the assertion below
		# is actually testing the batch-enrollment branch.
		self.assertFalse(frappe.db.exists("LMS Enrollment", {"member": self.batch_only.name}))
		self.assertIn(self.batch_only.name, self._matched())

	def test_batch_only_student_counts_as_free(self):
		self.assertIn(self.batch_only.name, self._matched("Free"))
		self.assertNotIn(self.batch_only.name, self._matched("Paid"))

	def test_paid_batch_student_counts_as_paid(self):
		payment = frappe.get_doc(
			{
				"doctype": "LMS Payment",
				"member": self.batch_only.name,
				"payment_received": 1,
				"amount": 100,
				"payment_for_document_type": "LMS Batch",
				"payment_for_document": self.batch.name,
			}
		).insert(ignore_mandatory=True)
		self.addCleanup(lambda: frappe.delete_doc("LMS Payment", payment.name, force=True))
		frappe.db.set_value("LMS Batch Enrollment", self.enrollment.name, "payment", payment.name)

		self.assertIn(self.batch_only.name, self._matched("Paid"))


class TestStudentsOfBatchesRule(FrappeTestCase):
	def setUp(self):
		self.batch = frappe.get_doc(
			{
				"doctype": "LMS Batch",
				"title": "Raven Test Batch",
				"start_date": frappe.utils.today(),
				"end_date": frappe.utils.add_days(frappe.utils.today(), 7),
				"description": "Test batch for Raven integration tests",
				"batch_details": "Test batch details",
				"start_time": "09:00:00",
				"end_time": "10:00:00",
				"timezone": "Asia/Kolkata",
				"instructors": [{"instructor": "Administrator"}],
			}
		).insert()
		self.in_batch = frappe.get_doc(
			{
				"doctype": "User",
				"email": "in-batch@example.com",
				"first_name": "In Batch",
				"send_welcome_email": 0,
			}
		).insert()
		self.out_of_batch = frappe.get_doc(
			{
				"doctype": "User",
				"email": "out-batch@example.com",
				"first_name": "Out",
				"send_welcome_email": 0,
			}
		).insert()
		self.enrollment = frappe.get_doc(
			{
				"doctype": "LMS Batch Enrollment",
				"member": self.in_batch.name,
				"batch": self.batch.name,
			}
		).insert()
		# LIFO: last-added cleanup runs first. Add parents before children so
		# enrollment (child) is deleted before batch/users (parents).
		self.addCleanup(self.batch.delete)
		self.addCleanup(self.in_batch.delete)
		self.addCleanup(self.out_of_batch.delete)
		self.addCleanup(self.enrollment.delete)

	def test_matches_only_batch_members(self):
		rule = {
			"rule_type": "Students of Batches",
			"payment_filter": "Any",
			"batches": [self.batch.name],
		}
		matched = default_evaluator(rule)
		self.assertIn(self.in_batch.name, matched)
		self.assertNotIn(self.out_of_batch.name, matched)

	def test_paid_only_filters_out_unpaid(self):
		rule = {
			"rule_type": "Students of Batches",
			"payment_filter": "Paid",
			"batches": [self.batch.name],
		}
		matched = default_evaluator(rule)
		self.assertNotIn(self.in_batch.name, matched)


class TestStudentsOfCoursesRule(FrappeTestCase):
	def setUp(self):
		existing = frappe.get_all("LMS Course", limit=1)
		if not existing:
			self.skipTest("No course fixture; populate one before running this test")
		self.course = existing[0].name
		self.in_course = frappe.get_doc(
			{
				"doctype": "User",
				"email": "raven-in-course@example.com",
				"first_name": "InCourse",
				"send_welcome_email": 0,
			}
		).insert()
		self.enrollment = frappe.get_doc(
			{
				"doctype": "LMS Enrollment",
				"member": self.in_course.name,
				"course": self.course,
			}
		).insert()
		# LIFO: add parent (user) before child (enrollment) so enrollment is
		# deleted first, then the user.
		self.addCleanup(self.in_course.delete)
		self.addCleanup(self.enrollment.delete)

	def test_matches_only_course_enrollees(self):
		rule = {
			"rule_type": "Students of Courses",
			"payment_filter": "Any",
			"courses": [self.course],
		}
		matched = default_evaluator(rule)
		self.assertIn(self.in_course.name, matched)

	def test_paid_only_filters_out_unpaid(self):
		rule = {
			"rule_type": "Students of Courses",
			"payment_filter": "Paid",
			"courses": [self.course],
		}
		matched = default_evaluator(rule)
		self.assertNotIn(self.in_course.name, matched)

	def test_payment_filter_free_matches_unpaid_enrollee(self):
		rule = {
			"rule_type": "Students of Courses",
			"payment_filter": "Free",
			"courses": [self.course],
		}
		matched = default_evaluator(rule)
		self.assertIn(self.in_course.name, matched)

	def test_payment_filter_paid_excludes_unpaid_enrollee(self):
		rule = {
			"rule_type": "Students of Courses",
			"payment_filter": "Paid",
			"courses": [self.course],
		}
		matched = default_evaluator(rule)
		self.assertNotIn(self.in_course.name, matched)


class TestPaymentFilter(FrappeTestCase):
	"""Paid / Free filters against real LMS Payment rows.

	The other suites only ever assert that a payment-less enrollee is excluded from
	Paid, which passes even if the join is broken. These pin the join itself:
	payment_received=1 is Paid, payment_received=0 is Free, and a dangling payment
	link is neither.
	"""

	def _user(self, email: str) -> "frappe.Document":
		user = frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": email.split("@")[0],
				"send_welcome_email": 0,
			}
		).insert()
		self.addCleanup(lambda: frappe.delete_doc("User", user.name, force=True))
		return user

	def _payment(self, member: str, received: int) -> str:
		payment = frappe.get_doc(
			{
				"doctype": "LMS Payment",
				"member": member,
				"payment_received": received,
				"amount": 100,
				"payment_for_document_type": "LMS Batch",
				"payment_for_document": self.batch.name,
			}
		).insert(ignore_mandatory=True)
		self.addCleanup(lambda: frappe.delete_doc("LMS Payment", payment.name, force=True))
		return payment.name

	def _enroll(self, member: str, payment: str | None) -> None:
		enrollment = frappe.get_doc(
			{"doctype": "LMS Batch Enrollment", "member": member, "batch": self.batch.name}
		).insert()
		self.addCleanup(lambda: frappe.delete_doc("LMS Batch Enrollment", enrollment.name, force=True))
		if payment:
			# set_value bypasses link validation, which the dangling case needs.
			frappe.db.set_value("LMS Batch Enrollment", enrollment.name, "payment", payment)

	def setUp(self):
		self.batch = frappe.get_doc(
			{
				"doctype": "LMS Batch",
				"title": "Raven Payment Filter Batch",
				"start_date": frappe.utils.today(),
				"end_date": frappe.utils.add_days(frappe.utils.today(), 7),
				"description": "Payment filter test batch",
				"batch_details": "Payment filter test batch details",
				"start_time": "09:00:00",
				"end_time": "10:00:00",
				"timezone": "Asia/Kolkata",
				"instructors": [{"instructor": "Administrator"}],
			}
		).insert()
		self.addCleanup(lambda: frappe.delete_doc("LMS Batch", self.batch.name, force=True))

		self.paid = self._user("raven-paid@example.com")
		self.unpaid = self._user("raven-unpaid@example.com")
		self.dangling = self._user("raven-dangling@example.com")
		self.free = self._user("raven-free@example.com")

		self._enroll(self.paid.name, self._payment(self.paid.name, 1))
		self._enroll(self.unpaid.name, self._payment(self.unpaid.name, 0))
		self._enroll(self.dangling.name, "LMS-PAYMENT-DOES-NOT-EXIST")
		self._enroll(self.free.name, None)

	def _matched(self, payment_filter: str) -> set:
		return default_evaluator(
			{
				"rule_type": "Students of Batches",
				"payment_filter": payment_filter,
				"batches": [self.batch.name],
			}
		)

	def test_paid_matches_only_payment_received(self):
		matched = self._matched("Paid")
		self.assertEqual(
			matched & {self.paid.name, self.unpaid.name, self.dangling.name, self.free.name},
			{self.paid.name},
		)

	def test_free_matches_unpaid_and_payment_less(self):
		matched = self._matched("Free")
		self.assertIn(self.unpaid.name, matched)
		self.assertIn(self.free.name, matched)
		self.assertNotIn(self.paid.name, matched)

	def test_dangling_payment_link_matches_neither(self):
		"""A payment link pointing at a deleted LMS Payment falls out of both sets.

		This is inherited behaviour, pinned deliberately so the frappe.qb rewrite
		can't drift from the raw SQL it replaced. It is arguably wrong (the student
		vanishes from every rule) — changing it is a product decision, not a refactor.
		"""
		self.assertNotIn(self.dangling.name, self._matched("Paid"))
		self.assertNotIn(self.dangling.name, self._matched("Free"))

	def test_any_matches_all_four(self):
		matched = self._matched("Any")
		for user in (self.paid, self.unpaid, self.dangling, self.free):
			self.assertIn(user.name, matched)


class TestBatchEnrollmentIndex(UnitTestCase):
	"""The (batch, member) index that TestRulePerformance's 200ms budget depends on.

	Added by lms.patches.v2_0.add_batch_enrollment_index. Schema-only, so UnitTestCase
	— IntegrationTestCase's test-record loader trips the Fiscal Year overlap flake here.
	"""

	def test_batch_member_index_exists(self):
		index_name = frappe.db.get_index_name(["batch", "member"])
		self.assertTrue(
			frappe.db.has_index("tabLMS Batch Enrollment", index_name),
			f"Index {index_name} is missing from tabLMS Batch Enrollment — run `bench migrate` "
			"to apply lms.patches.v2_0.add_batch_enrollment_index.",
		)


class TestStaffRule(FrappeTestCase):
	"""Task 11: Staff rule — Instructor / Evaluator / Mentor / Any + scope filters.

	Schema notes (verified against doctype JSON 2026-05-23):
	  Course Instructor  : child table shared by LMS Course and LMS Batch.
	                       parenttype='LMS Course'|'LMS Batch', user field=`instructor`.
	  Course Evaluator   : standalone doctype, no course/batch link, user field=`evaluator`.
	  LMS Course Mentor Mapping : has `course` + `mentor` fields.
	"""

	def setUp(self):
		# Skip before creating anything. With no LMS Course fixture this suite has
		# nothing to attach staff to — and checking after inserting the users would
		# leak them (User.insert commits, and addCleanup is only registered at the
		# end of setUp), making every later method fail on the duplicate user.
		existing = frappe.get_all("LMS Course", limit=1)
		if not existing:
			self.skipTest("No course fixture; populate one before running this test")
		self.course = existing[0].name

		self.instructor_user = frappe.get_doc(
			{
				"doctype": "User",
				"email": "raven-instructor@example.com",
				"first_name": "Raven Instructor",
				"send_welcome_email": 0,
			}
		).insert()
		self.evaluator_user = frappe.get_doc(
			{
				"doctype": "User",
				"email": "raven-evaluator@example.com",
				"first_name": "Raven Evaluator",
				"send_welcome_email": 0,
			}
		).insert()
		self.mentor_user = frappe.get_doc(
			{
				"doctype": "User",
				"email": "raven-mentor@example.com",
				"first_name": "Raven Mentor",
				"send_welcome_email": 0,
			}
		).insert()
		self.other_user = frappe.get_doc(
			{
				"doctype": "User",
				"email": "raven-nostaff@example.com",
				"first_name": "Raven NoStaff",
				"send_welcome_email": 0,
			}
		).insert()

		self.course_doc = frappe.get_doc("LMS Course", self.course)
		self.course_doc.append("instructors", {"instructor": self.instructor_user.name})
		self.course_doc.save(ignore_permissions=True)

		if not frappe.db.exists("Course Evaluator", self.evaluator_user.name):
			self.evaluator_doc = frappe.get_doc(
				{"doctype": "Course Evaluator", "evaluator": self.evaluator_user.name}
			).insert()
		else:
			self.evaluator_doc = frappe.get_doc("Course Evaluator", self.evaluator_user.name)

		self.mentor_mapping = frappe.get_doc(
			{
				"doctype": "LMS Course Mentor Mapping",
				"course": self.course,
				"mentor": self.mentor_user.name,
			}
		).insert()

		self.addCleanup(self._cleanup)

	def _cleanup(self):
		course_doc = frappe.get_doc("LMS Course", self.course)
		course_doc.instructors = [
			row for row in course_doc.instructors if row.instructor != self.instructor_user.name
		]
		course_doc.save(ignore_permissions=True)

		if frappe.db.exists("Course Evaluator", self.evaluator_user.name):
			frappe.delete_doc("Course Evaluator", self.evaluator_user.name, force=True)

		if frappe.db.exists("LMS Course Mentor Mapping", self.mentor_mapping.name):
			frappe.delete_doc("LMS Course Mentor Mapping", self.mentor_mapping.name, force=True)

		for user in (self.instructor_user, self.evaluator_user, self.mentor_user, self.other_user):
			if frappe.db.exists("User", user.name):
				frappe.delete_doc("User", user.name, force=True)

	def _rule(self, **kwargs) -> dict:
		base = {
			"rule_type": "Staff",
			"payment_filter": "Any",
			"batches": [],
			"courses": [],
			"staff_role": None,
			"staff_scope_batches": [],
			"staff_scope_courses": [],
		}
		base.update(kwargs)
		return base

	# --- Instructor ---

	def test_instructor_role_returns_course_instructors(self):
		"""staff_role=Instructor returns user from Course Instructor (unscoped)."""
		matched = default_evaluator(self._rule(staff_role="Instructor"))
		self.assertIn(self.instructor_user.name, matched)
		self.assertNotIn(self.other_user.name, matched)

	def test_instructor_role_scoped_to_course_returns_only_that_course(self):
		"""staff_role=Instructor + staff_scope_courses=[X] returns only X's instructors."""
		matched = default_evaluator(
			self._rule(
				staff_role="Instructor",
				staff_scope_courses=[self.course],
			)
		)
		self.assertIn(self.instructor_user.name, matched)
		matched_other = default_evaluator(
			self._rule(
				staff_role="Instructor",
				staff_scope_courses=["NON-EXISTENT-COURSE"],
			)
		)
		self.assertNotIn(self.instructor_user.name, matched_other)

	# --- Evaluator ---

	def test_evaluator_role_returns_course_evaluators(self):
		"""staff_role=Evaluator returns users from Course Evaluator (standalone, no scope)."""
		matched = default_evaluator(self._rule(staff_role="Evaluator"))
		self.assertIn(self.evaluator_user.name, matched)
		self.assertNotIn(self.other_user.name, matched)

	def test_evaluator_scope_courses_ignored(self):
		"""Course Evaluator has no course link, so scope_courses has no effect on results."""
		matched_scoped = default_evaluator(
			self._rule(
				staff_role="Evaluator",
				staff_scope_courses=[self.course],
			)
		)
		matched_unscoped = default_evaluator(self._rule(staff_role="Evaluator"))
		self.assertIn(self.evaluator_user.name, matched_scoped)
		self.assertEqual(
			self.evaluator_user.name in matched_scoped,
			self.evaluator_user.name in matched_unscoped,
		)

	# --- Mentor ---

	def test_mentor_role_returns_mentor_mapping_members(self):
		"""staff_role=Mentor returns users from LMS Course Mentor Mapping."""
		matched = default_evaluator(self._rule(staff_role="Mentor"))
		self.assertIn(self.mentor_user.name, matched)
		self.assertNotIn(self.other_user.name, matched)

	def _batch(self, title: str, courses: list[str]) -> "frappe.Document":
		batch = frappe.get_doc(
			{
				"doctype": "LMS Batch",
				"title": title,
				"start_date": frappe.utils.today(),
				"end_date": frappe.utils.add_days(frappe.utils.today(), 7),
				"description": f"{title} description",
				"batch_details": f"{title} details",
				"start_time": "09:00:00",
				"end_time": "10:00:00",
				"timezone": "Asia/Kolkata",
				"instructors": [{"instructor": "Administrator"}],
				"courses": [{"course": course} for course in courses],
			}
		).insert()
		self.addCleanup(lambda: frappe.delete_doc("LMS Batch", batch.name, force=True))
		return batch

	def test_mentor_scoped_to_batch_returns_mentors_of_batch_courses(self):
		"""staff_scope_batches must be honoured: batch → its Batch Course rows → mentors."""
		batch = self._batch("Raven Mentor Scope Batch", [self.course])
		matched = default_evaluator(self._rule(staff_role="Mentor", staff_scope_batches=[batch.name]))
		self.assertIn(self.mentor_user.name, matched)

	def test_mentor_scoped_to_batch_without_courses_matches_nobody(self):
		"""A batch scope that resolves to no courses must return {}, never every mentor.

		Regression: the Mentor branch read staff_scope_batches but only consumed
		staff_scope_courses, so a batch-only scope built filters={} and handed the rule
		every mentor on the site.
		"""
		batch = self._batch("Raven Mentor Empty Batch", [])
		matched = default_evaluator(self._rule(staff_role="Mentor", staff_scope_batches=[batch.name]))
		self.assertNotIn(self.mentor_user.name, matched)
		self.assertEqual(matched, set())

	def test_mentor_scoped_to_unknown_batch_matches_nobody(self):
		matched = default_evaluator(
			self._rule(staff_role="Mentor", staff_scope_batches=["NON-EXISTENT-BATCH"])
		)
		self.assertEqual(matched, set())

	def test_mentor_course_and_batch_scopes_union(self):
		batch = self._batch("Raven Mentor Union Batch", [self.course])
		matched = default_evaluator(
			self._rule(
				staff_role="Mentor",
				staff_scope_courses=["NON-EXISTENT-COURSE"],
				staff_scope_batches=[batch.name],
			)
		)
		self.assertIn(self.mentor_user.name, matched)

	def test_mentor_scoped_to_course(self):
		"""staff_role=Mentor + staff_scope_courses=[X] returns only X's mentors."""
		matched = default_evaluator(
			self._rule(
				staff_role="Mentor",
				staff_scope_courses=[self.course],
			)
		)
		self.assertIn(self.mentor_user.name, matched)
		matched_other = default_evaluator(
			self._rule(
				staff_role="Mentor",
				staff_scope_courses=["NON-EXISTENT-COURSE"],
			)
		)
		self.assertNotIn(self.mentor_user.name, matched_other)

	# --- Any ---

	def test_any_role_unions_all_three_sources(self):
		"""staff_role=Any returns union of instructors + evaluators + mentors."""
		matched = default_evaluator(self._rule(staff_role="Any"))
		self.assertIn(self.instructor_user.name, matched)
		self.assertIn(self.evaluator_user.name, matched)
		self.assertIn(self.mentor_user.name, matched)
		self.assertNotIn(self.other_user.name, matched)

	def test_any_deduplicates_user_appearing_in_multiple_roles(self):
		"""A user who is both instructor and mentor appears once in the result set."""
		dual_mapping = frappe.get_doc(
			{
				"doctype": "LMS Course Mentor Mapping",
				"course": self.course,
				"mentor": self.instructor_user.name,
			}
		).insert()
		self.addCleanup(lambda: frappe.delete_doc("LMS Course Mentor Mapping", dual_mapping.name, force=True))
		matched = default_evaluator(self._rule(staff_role="Any"))
		self.assertIn(self.instructor_user.name, matched)
		self.assertIsInstance(matched, set)


class TestRulePerformance(FrappeTestCase):
	"""Task 17: default_evaluator for 'Students of Batches' must return under 200ms for 1000 members.

	The budget depends on the (batch, member) index added by
	lms.patches.v2_0.add_batch_enrollment_index — without it the query is a full table
	scan. TestBatchEnrollmentIndex asserts the index directly; this test would still pass
	unindexed on a small dev DB, so treat that one as the real guard.
	"""

	_TOTAL = 1000
	_EMAIL_SUFFIX = "@example.com"
	_THRESHOLD_SEC = 0.200

	@staticmethod
	def _perf_email(j: int) -> str:
		return f"user-perf-{j}@example.com"

	def setUp(self):
		now = frappe.utils.now()
		self.batch = frappe.get_doc(
			{
				"doctype": "LMS Batch",
				"title": "Perf Test Batch",
				"start_date": frappe.utils.today(),
				"end_date": frappe.utils.add_days(frappe.utils.today(), 7),
				"description": "Performance test batch",
				"batch_details": "Performance test batch details",
				"start_time": "09:00:00",
				"end_time": "10:00:00",
				"timezone": "Asia/Kolkata",
				"instructors": [{"instructor": "Administrator"}],
			}
		).insert()

		audit = (now, now, "Administrator", "Administrator")
		emails = [self._perf_email(j) for j in range(self._TOTAL)]

		# bulk_insert, not per-row insert() — 1000 ORM inserts takes minutes.
		frappe.db.bulk_insert(
			"User",
			["name", "creation", "modified", "owner", "modified_by", "user_type", "email", "first_name"],
			[(email, *audit, "User", email, f"Perf{j}") for j, email in enumerate(emails)],
			ignore_duplicates=True,
		)
		frappe.db.bulk_insert(
			"LMS Batch Enrollment",
			["name", "creation", "modified", "owner", "modified_by", "batch", "member"],
			[(f"perf-enroll-{j}", *audit, self.batch.name, email) for j, email in enumerate(emails)],
			ignore_duplicates=True,
		)

	def tearDown(self):
		# Set-based cleanup — the ORM would issue 1000 separate deletes.
		perf_members = f"user-perf-%{self._EMAIL_SUFFIX}"
		enrollment = frappe.qb.DocType("LMS Batch Enrollment")
		frappe.qb.from_(enrollment).delete().where(enrollment.member.like(perf_members)).run()
		user = frappe.qb.DocType("User")
		frappe.qb.from_(user).delete().where(user.name.like(perf_members)).run()
		if frappe.db.exists("LMS Batch", self.batch.name):
			frappe.delete_doc("LMS Batch", self.batch.name, force=True)

	def test_evaluate_rule_under_200ms_for_1000_students(self):
		"""default_evaluator(Students of Batches) for a 1000-member batch must complete under 200ms."""
		rule = {
			"rule_type": "Students of Batches",
			"payment_filter": "Any",
			"batches": [self.batch.name],
		}

		t0 = time.monotonic()
		result = default_evaluator(rule)
		elapsed = time.monotonic() - t0

		self.assertEqual(len(result), self._TOTAL, f"Expected {self._TOTAL} members, got {len(result)}")

		self.assertLess(
			elapsed,
			self._THRESHOLD_SEC,
			f"default_evaluator took {elapsed * 1000:.1f}ms — exceeds {self._THRESHOLD_SEC * 1000:.0f}ms "
			f"threshold. Check that lms.patches.v2_0.add_batch_enrollment_index has run.",
		)
