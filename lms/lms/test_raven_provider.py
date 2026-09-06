import importlib.util
import sys
import time
import types

import frappe
from frappe.tests import UnitTestCase
from frappe.tests.utils import FrappeTestCase

from lms import raven_provider
from lms.raven_provider import (
	ProviderDataError,
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
			"rule_type": "Student",
			"student_scope": "Enrolled",
			"payment_filter": "Any",
			"enrolled_in": "Any",
		}
		matched = default_evaluator(rule)
		self.assertIn(self.enrolled.name, matched)
		self.assertNotIn(self.unenrolled.name, matched)


class TestAllEnrolledIncludesBatchOnlyStudents(FrappeTestCase):
	"""'All Enrolled Students' must not drop students who only have a batch enrollment.

	LMS Batch Enrollment mirrors itself into one LMS Enrollment per Batch Course row, so a
	batch with no courses mirrors nothing. Membership sync is authoritative. An omission
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
		return default_evaluator(
			{
				"rule_type": "Student",
				"student_scope": "Enrolled",
				"payment_filter": payment_filter,
				"enrolled_in": "Any",
			}
		)

	def test_batch_only_student_is_enrolled(self):
		# The mirror never ran (no Batch Course rows). Prove it, so the assertion below
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
			"rule_type": "Student",
			"student_scope": "Enrolled",
			"enrolled_in": "Batches",
			"payment_filter": "Any",
			"batches": [self.batch.name],
		}
		matched = default_evaluator(rule)
		self.assertIn(self.in_batch.name, matched)
		self.assertNotIn(self.out_of_batch.name, matched)

	def test_paid_only_filters_out_unpaid(self):
		rule = {
			"rule_type": "Student",
			"student_scope": "Enrolled",
			"enrolled_in": "Batches",
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
			"rule_type": "Student",
			"student_scope": "Enrolled",
			"enrolled_in": "Courses",
			"payment_filter": "Any",
			"courses": [self.course],
		}
		matched = default_evaluator(rule)
		self.assertIn(self.in_course.name, matched)

	def test_paid_only_filters_out_unpaid(self):
		rule = {
			"rule_type": "Student",
			"student_scope": "Enrolled",
			"enrolled_in": "Courses",
			"payment_filter": "Paid",
			"courses": [self.course],
		}
		matched = default_evaluator(rule)
		self.assertNotIn(self.in_course.name, matched)

	def test_payment_filter_free_matches_unpaid_enrollee(self):
		rule = {
			"rule_type": "Student",
			"student_scope": "Enrolled",
			"enrolled_in": "Courses",
			"payment_filter": "Free",
			"courses": [self.course],
		}
		matched = default_evaluator(rule)
		self.assertIn(self.in_course.name, matched)

	def test_payment_filter_paid_excludes_unpaid_enrollee(self):
		rule = {
			"rule_type": "Student",
			"student_scope": "Enrolled",
			"enrolled_in": "Courses",
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
				"rule_type": "Student",
				"student_scope": "Enrolled",
				"enrolled_in": "Batches",
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
		vanishes from every rule). Changing it is a product decision, not a refactor.
		"""
		self.assertNotIn(self.dangling.name, self._matched("Paid"))
		self.assertNotIn(self.dangling.name, self._matched("Free"))

	def test_any_matches_all_four(self):
		matched = self._matched("Any")
		for user in (self.paid, self.unpaid, self.dangling, self.free):
			self.assertIn(user.name, matched)


class TestBatchEnrollmentIndex(UnitTestCase):
	"""The (batch, member) index that TestRulePerformance's 200ms budget depends on.

	Added by lms.patches.v2_0.add_batch_enrollment_index. Schema-only, so UnitTestCase.
	IntegrationTestCase's test-record loader trips the Fiscal Year overlap flake here.
	"""

	def test_batch_member_index_exists(self):
		# Either index serves the lookup: unique_batch_member covers the same two
		# columns in the same order, so add_enrollment_unique_constraints drops
		# the plain one once it is in place. What this test protects is the
		# coverage, not the name.
		index_name = frappe.db.get_index_name(["batch", "member"])
		self.assertTrue(
			frappe.db.has_index("tabLMS Batch Enrollment", index_name)
			or frappe.db.has_index("tabLMS Batch Enrollment", "unique_batch_member"),
			"No (batch, member) index on tabLMS Batch Enrollment. Run `bench migrate` to "
			"apply lms.patches.v2_0.add_batch_enrollment_index or "
			"lms.patches.v2_0.add_enrollment_unique_constraints.",
		)


class TestStudentScope(FrappeTestCase):
	"""The Student cascade's two ends: All, and Enrolled across both scopes."""

	def setUp(self):
		existing = frappe.get_all("LMS Course", limit=1)
		if not existing:
			self.skipTest("No course fixture; populate one before running this test")
		self.course = existing[0].name

		self.student = frappe.get_doc(
			{
				"doctype": "User",
				"email": "raven-student-scope@example.com",
				"first_name": "Raven Student Scope",
				"send_welcome_email": 0,
			}
		).insert()
		self.addCleanup(self.student.delete)
		self.student.add_roles("LMS Student")

		self.roleless = frappe.get_doc(
			{
				"doctype": "User",
				"email": "raven-no-student-role@example.com",
				"first_name": "Raven No Student Role",
				"send_welcome_email": 0,
			}
		).insert()
		self.addCleanup(self.roleless.delete)
		frappe.db.delete("Has Role", {"parent": self.roleless.name, "role": "LMS Student"})

	def test_all_is_everyone_holding_the_student_role(self):
		members = default_evaluator({"rule_type": "Student", "student_scope": "All"})
		self.assertIn(self.student.name, members)
		self.assertNotIn(self.roleless.name, members)

	def test_all_ends_the_cascade(self):
		"""Nothing below All is read. A rule edited down from Enrolled may still
		carry a payment filter and a scope; what the row shows is what it means."""
		wide = default_evaluator({"rule_type": "Student", "student_scope": "All"})
		with_leftovers = default_evaluator(
			{
				"rule_type": "Student",
				"student_scope": "All",
				"payment_filter": "Paid",
				"enrolled_in": "Courses",
				"courses": ["NON-EXISTENT-COURSE"],
			}
		)
		self.assertEqual(wide, with_leftovers)

	def test_a_disabled_holder_is_not_named(self):
		frappe.db.set_value("User", self.student.name, "enabled", 0)
		self.addCleanup(frappe.db.set_value, "User", self.student.name, "enabled", 1)
		members = default_evaluator({"rule_type": "Student", "student_scope": "All"})
		self.assertNotIn(self.student.name, members)

	def test_enrolled_in_both_unions_the_two_scopes(self):
		batches = frappe.get_all("LMS Batch", limit=1)
		if not batches:
			self.skipTest("No batch fixture")
		both = default_evaluator(
			{
				"rule_type": "Student",
				"student_scope": "Enrolled",
				"payment_filter": "Any",
				"enrolled_in": "Both",
				"batches": [batches[0].name],
				"courses": [self.course],
			}
		)
		only_courses = default_evaluator(
			{
				"rule_type": "Student",
				"student_scope": "Enrolled",
				"payment_filter": "Any",
				"enrolled_in": "Courses",
				"courses": [self.course],
			}
		)
		only_batches = default_evaluator(
			{
				"rule_type": "Student",
				"student_scope": "Enrolled",
				"payment_filter": "Any",
				"enrolled_in": "Batches",
				"batches": [batches[0].name],
			}
		)
		self.assertEqual(both, only_courses | only_batches)

	def test_an_unknown_scope_is_unevaluable_rather_than_empty(self):
		for gone in ("Everyone", ""):
			with self.assertRaises(ProviderDataError):
				default_evaluator({"rule_type": "Student", "student_scope": gone})

	def test_the_rule_types_this_replaced_are_unevaluable(self):
		for gone in (
			"All Enrolled Students",
			"Students of Courses",
			"Students of Batches",
		):
			with self.assertRaises(ProviderDataError):
				default_evaluator({"rule_type": gone, "payment_filter": "Any"})


class TestStaffRule(FrappeTestCase):
	"""Staff rule: three role choices and one tagging choice.

	Course Creator, Evaluator and Moderator each name a Frappe role, which is
	site-wide, so there is nothing to scope them to. Instructor is a `Course
	Instructor` row on a course or a batch, so it is the only choice that reads
	the scope fields.
	"""

	def setUp(self):
		# Skip before creating anything. With no LMS Course fixture there is
		# nothing to attach an instructor to, and inserting the users first would
		# leak them: User.insert commits, and addCleanup runs only from here on.
		existing = frappe.get_all("LMS Course", limit=1)
		if not existing:
			self.skipTest("No course fixture; populate one before running this test")
		self.course = existing[0].name

		self.users = {}
		for key, email in (
			("instructor", "raven-instructor@example.com"),
			("creator", "raven-creator@example.com"),
			("evaluator", "raven-evaluator@example.com"),
			("moderator", "raven-moderator@example.com"),
			("assigned_evaluator", "raven-assigned-evaluator@example.com"),
			("disabled", "raven-disabled-mod@example.com"),
			("other", "raven-nostaff@example.com"),
		):
			self.users[key] = frappe.get_doc(
				{
					"doctype": "User",
					"email": email,
					"first_name": email.split("@")[0],
					"send_welcome_email": 0,
				}
			).insert()

		self.users["creator"].add_roles("Course Creator")
		self.users["evaluator"].add_roles("Batch Evaluator")
		self.users["moderator"].add_roles("Moderator")

		# Holds the role but is switched off: the sync cannot link a member row to a
		# user with no Raven User row, so a disabled holder must not be named.
		self.users["disabled"].add_roles("Moderator")
		frappe.db.set_value("User", self.users["disabled"].name, "enabled", 0)

		self.course_doc = frappe.get_doc("LMS Course", self.course)
		self.course_doc.append("instructors", {"instructor": self.users["instructor"].name})
		# The other per-record tagging: LMS Course.evaluator links Course Evaluator.
		# A different user from the platform-role evaluator, so a test naming one
		# cannot pass by accident on the other.
		frappe.get_doc(
			{"doctype": "Course Evaluator", "evaluator": self.users["assigned_evaluator"].name}
		).insert(ignore_permissions=True)
		self.previous_evaluator = self.course_doc.evaluator
		self.course_doc.evaluator = self.users["assigned_evaluator"].name
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture, seeding the rows the cases read back
		self.course_doc.save(ignore_permissions=True)

		self.addCleanup(self._cleanup)

	def _cleanup(self):
		course_doc = frappe.get_doc("LMS Course", self.course)
		course_doc.instructors = [
			row for row in course_doc.instructors if row.instructor != self.users["instructor"].name
		]
		course_doc.evaluator = self.previous_evaluator
		course_doc.save(ignore_permissions=True)
		if frappe.db.exists("Course Evaluator", self.users["assigned_evaluator"].name):
			frappe.delete_doc("Course Evaluator", self.users["assigned_evaluator"].name, force=True)

		for user in self.users.values():
			if frappe.db.exists("User", user.name):
				frappe.delete_doc("User", user.name, force=True)

	def _rule(self, **kwargs) -> dict:
		base = {
			"rule_type": "Staff",
			"staff_kind": None,
			"platform_roles": [],
			"assigned_as": None,
			"assigned_scope": "Any",
			"staff_scope_batches": [],
			"staff_scope_courses": [],
		}
		base.update(kwargs)
		return base

	def _assigned(self, **kwargs) -> dict:
		return self._rule(staff_kind="Assigned on", **kwargs)

	def _platform(self, *roles) -> dict:
		return self._rule(staff_kind="Platform role", platform_roles=list(roles))

	# --- Assigned on: named in a course or batch's own field ---

	def test_instructor_unscoped_returns_every_course_instructor(self):
		members = default_evaluator(self._assigned(assigned_as="Instructor"))
		self.assertIn(self.users["instructor"].name, members)
		self.assertNotIn(self.users["other"].name, members)

	def test_instructor_scoped_to_its_course(self):
		members = default_evaluator(
			self._assigned(
				assigned_as="Instructor",
				assigned_scope="Courses",
				staff_scope_courses=[self.course],
			)
		)
		self.assertIn(self.users["instructor"].name, members)

	def test_instructor_scoped_elsewhere_matches_nobody(self):
		members = default_evaluator(
			self._assigned(
				assigned_as="Instructor",
				assigned_scope="Courses",
				staff_scope_courses=["NON-EXISTENT-COURSE"],
			)
		)
		self.assertNotIn(self.users["instructor"].name, members)

	def test_a_scope_of_any_ignores_a_scope_left_in_the_config(self):
		"""The multiselects are hidden while the scope reads Any, but a rule edited
		down from Courses may still carry them. What the row shows is what it
		means."""
		members = default_evaluator(
			self._assigned(
				assigned_as="Instructor",
				assigned_scope="Any",
				staff_scope_courses=["NON-EXISTENT-COURSE"],
			)
		)
		self.assertIn(self.users["instructor"].name, members)

	# --- Assigned on: Evaluator, the other per-record tagging ---

	def test_assigned_evaluator_unscoped_returns_everyone_named_on_a_record(self):
		members = default_evaluator(self._assigned(assigned_as="Evaluator"))
		self.assertIn(self.users["assigned_evaluator"].name, members)
		self.assertNotIn(self.users["instructor"].name, members)

	def test_assigned_evaluator_is_not_the_platform_evaluator_role(self):
		"""The two "Evaluator"s name different people, which is the whole reason
		they are separate branches. `evaluator` holds the Batch Evaluator role and
		is named on no record; `assigned_evaluator` is named on the course."""
		assigned = default_evaluator(self._assigned(assigned_as="Evaluator"))
		self.assertNotIn(self.users["evaluator"].name, assigned)

		platform = default_evaluator(self._platform("Evaluator"))
		self.assertIn(self.users["evaluator"].name, platform)

	def test_assigned_evaluator_scoped_to_its_course(self):
		# A narrowing develop did not have: it ignored scope for evaluators.
		members = default_evaluator(
			self._assigned(
				assigned_as="Evaluator",
				assigned_scope="Courses",
				staff_scope_courses=[self.course],
			)
		)
		self.assertEqual(members, {self.users["assigned_evaluator"].name})

	def test_assigned_evaluator_scoped_elsewhere_matches_nobody(self):
		members = default_evaluator(
			self._assigned(
				assigned_as="Evaluator",
				assigned_scope="Courses",
				staff_scope_courses=["NON-EXISTENT-COURSE"],
			)
		)
		self.assertEqual(members, set())

	def test_an_unknown_assigned_as_is_unevaluable_rather_than_empty(self):
		for gone in ("Mentor", ""):
			with self.assertRaises(ProviderDataError):
				default_evaluator(self._assigned(assigned_as=gone))

	# --- A scope chosen but left empty ---

	def test_an_empty_chosen_scope_matches_nobody_rather_than_everyone(self):
		"""The dangerous direction. `_instructor_users` reads "no scope at all" as
		"every instructor on the site", so a Courses scope holding an empty list
		would widen the rule to everyone instead of narrowing it to no one, and
		membership sync being authoritative, widening adds real people to a
		channel. `reqd` stops the editor reaching this; stored data can, when the
		scope's only entry has since been deleted."""
		for as_what in ("Instructor", "Evaluator"):
			for scope, field in (
				("Courses", "staff_scope_courses"),
				("Batches", "staff_scope_batches"),
			):
				members = default_evaluator(
					self._assigned(assigned_as=as_what, assigned_scope=scope, **{field: []})
				)
				self.assertEqual(members, set(), f"{as_what} scoped to empty {scope} matched {members}")

	def test_a_scope_of_any_still_reaches_everyone(self):
		# The guard above must not be reachable by the unscoped case, which is a
		# deliberate "every instructor", not an empty scope.
		members = default_evaluator(self._assigned(assigned_as="Instructor"))
		self.assertIn(self.users["instructor"].name, members)

	# --- Platform role: a site-wide Frappe role ---

	def test_course_creator_returns_holders_of_that_role(self):
		members = default_evaluator(self._platform("Course Creator"))
		self.assertIn(self.users["creator"].name, members)
		self.assertNotIn(self.users["moderator"].name, members)
		self.assertNotIn(self.users["other"].name, members)

	def test_moderator_returns_holders_of_that_role(self):
		members = default_evaluator(self._platform("Moderator"))
		self.assertIn(self.users["moderator"].name, members)
		self.assertNotIn(self.users["creator"].name, members)

	def test_evaluator_reads_the_batch_evaluator_role(self):
		""" "Evaluator" is the wording on screen; `Batch Evaluator` is the role.

		Not the same population as an assigned evaluator, which is whoever the
		course or batch names in its own evaluator field. The two overlap only
		partly, which is why they are separate branches rather than one word."""
		members = default_evaluator(self._platform("Evaluator"))
		self.assertIn(self.users["evaluator"].name, members)
		self.assertNotIn(self.users["moderator"].name, members)

	def test_several_roles_union(self):
		members = default_evaluator(self._platform("Course Creator", "Moderator"))
		self.assertIn(self.users["creator"].name, members)
		self.assertIn(self.users["moderator"].name, members)
		self.assertNotIn(self.users["other"].name, members)

	def test_a_disabled_holder_is_not_named(self):
		members = default_evaluator(self._platform("Moderator"))
		self.assertNotIn(self.users["disabled"].name, members)

	# --- All: the three platform roles, and deliberately nothing else ---

	def test_all_is_the_union_of_the_three_platform_roles(self):
		members = default_evaluator(self._rule(staff_kind="All"))
		for key in ("creator", "evaluator", "moderator"):
			self.assertIn(self.users[key].name, members)
		self.assertNotIn(self.users["other"].name, members)

	def test_all_does_not_reach_someone_tagged_but_role_less(self):
		"""Recorded because it is invisible from the UI, and was chosen knowingly.

		Nothing grants a role when a user is tagged as an instructor, and
		CourseInstructor is a bare `pass` controller, so an instructor holding
		none of the three roles is outside Staff > All. Measured on the frappuccino
		bench when this was decided: 22 instructors, 4 of them role-less."""
		members = default_evaluator(self._rule(staff_kind="All"))
		self.assertNotIn(self.users["instructor"].name, members)

	# --- The vocabulary this replaced ---

	def test_a_rule_written_against_staff_role_is_unevaluable(self):
		# Every one of these was a choice once. Answering the empty set for them is
		# not "names nobody". Membership sync is authoritative, so it evicts every
		# rule-managed member of the channel. ProviderDataError is the answer for a
		# rule that cannot be evaluated: the read path logs and skips it, the sync
		# path raises before it can act on it.
		#
		# "Evaluator" is the one that matters. It does not fail on its own terms,
		# it used to mean every Course Evaluator record and would now mean holders
		# of the Batch Evaluator role, populations that only partly overlap. Left
		# to resolve, it would change a channel's membership with no error anywhere.
		for gone in ("Instructor", "Evaluator", "Mentor", "Any", ""):
			with self.assertRaises(ProviderDataError):
				default_evaluator({"rule_type": "Staff", "staff_role": gone})

	def test_the_unknown_kind_error_names_the_choices_that_do_exist(self):
		# Whoever finds this in an Error Log has to know what to change it to.
		with self.assertRaises(ProviderDataError) as caught:
			default_evaluator(self._rule(staff_kind="Mentor"))
		message = str(caught.exception)
		self.assertIn("Mentor", message)
		for choice in ("All", "Platform role", "Assigned on"):
			self.assertIn(choice, message)


class TestStaffScopedToABatch(FrappeTestCase):
	"""The batch half of "Assigned on", which reads Course Instructor rows whose
	parent is a batch, and the evaluator named on the batch's Batch Course rows.
	"""

	def setUp(self):
		existing = frappe.get_all("LMS Course", limit=1)
		if not existing:
			self.skipTest("No course fixture; populate one before running this test")
		self.course = existing[0].name

		self.instructor = frappe.get_doc(
			{
				"doctype": "User",
				"email": "raven-batch-instructor@example.com",
				"first_name": "Batch Instructor",
				"send_welcome_email": 0,
			}
		).insert()
		self.evaluator = frappe.get_doc(
			{
				"doctype": "User",
				"email": "raven-batch-evaluator@example.com",
				"first_name": "Batch Evaluator",
				"send_welcome_email": 0,
			}
		).insert()
		frappe.get_doc({"doctype": "Course Evaluator", "evaluator": self.evaluator.name}).insert(
			ignore_permissions=True
		)

		self.batch = frappe.get_doc(
			{
				"doctype": "LMS Batch",
				"title": "Raven Staff Scope Batch",
				"start_date": frappe.utils.today(),
				"end_date": frappe.utils.add_days(frappe.utils.today(), 7),
				"description": "Batch scope fixture",
				"batch_details": "Batch scope fixture",
				"start_time": "09:00:00",
				"end_time": "10:00:00",
				"timezone": "Asia/Kolkata",
				"instructors": [{"instructor": self.instructor.name}],
				"courses": [{"course": self.course, "evaluator": self.evaluator.name}],
			}
		).insert()
		self.elsewhere = frappe.get_doc(
			{
				"doctype": "LMS Batch",
				"title": "Raven Staff Scope Other Batch",
				"start_date": frappe.utils.today(),
				"end_date": frappe.utils.add_days(frappe.utils.today(), 7),
				"description": "Batch scope fixture",
				"batch_details": "Batch scope fixture",
				"start_time": "09:00:00",
				"end_time": "10:00:00",
				"timezone": "Asia/Kolkata",
				"instructors": [{"instructor": "Administrator"}],
			}
		).insert()

		self.addCleanup(self._cleanup)

	def _cleanup(self):
		for batch in (self.batch, self.elsewhere):
			if frappe.db.exists("LMS Batch", batch.name):
				frappe.delete_doc("LMS Batch", batch.name, force=True)
		if frappe.db.exists("Course Evaluator", self.evaluator.name):
			frappe.delete_doc("Course Evaluator", self.evaluator.name, force=True)
		for user in (self.instructor, self.evaluator):
			if frappe.db.exists("User", user.name):
				frappe.delete_doc("User", user.name, force=True)

	def _assigned(self, **kwargs) -> dict:
		return {"rule_type": "Staff", "staff_kind": "Assigned on", **kwargs}

	def test_instructor_scoped_to_its_batch(self):
		members = default_evaluator(
			self._assigned(
				assigned_as="Instructor",
				assigned_scope="Batches",
				staff_scope_batches=[self.batch.name],
			)
		)
		self.assertIn(self.instructor.name, members)

	def test_instructor_scoped_to_another_batch_matches_nobody(self):
		members = default_evaluator(
			self._assigned(
				assigned_as="Instructor",
				assigned_scope="Batches",
				staff_scope_batches=[self.elsewhere.name],
			)
		)
		self.assertNotIn(self.instructor.name, members)

	def test_evaluator_scoped_to_its_batch_reads_the_batch_course_row(self):
		members = default_evaluator(
			self._assigned(
				assigned_as="Evaluator",
				assigned_scope="Batches",
				staff_scope_batches=[self.batch.name],
			)
		)
		self.assertIn(self.evaluator.name, members)

	def test_both_unions_the_course_and_batch_scopes(self):
		members = default_evaluator(
			self._assigned(
				assigned_as="Instructor",
				assigned_scope="Both",
				staff_scope_batches=[self.batch.name],
				staff_scope_courses=[self.course],
			)
		)
		self.assertIn(self.instructor.name, members)


class TestTriggersFireAtAll(UnitTestCase):
	"""Every declared trigger must be a doctype whose save runs doc_events.

	raven_integration dispatches from a wildcard doc_events handler, which frappe
	only reaches through Document.run_method, the parent document's. A child row is
	written by the parent's update_child_table() with a direct d.db_update(), so a
	child doctype named here is a trigger that can never fire: membership stops
	reacting to the very edits it was listed for and waits for the nightly reconcile.
	"""

	def test_no_trigger_is_a_child_table(self):
		import frappe

		from lms.raven_provider import TRIGGERS

		for doctype in TRIGGERS:
			self.assertFalse(
				frappe.get_meta(doctype).istable,
				f"{doctype} is a child table, so doc_events never fires for it",
			)

	def test_the_staff_and_instructor_parents_are_declared(self):
		# Course Instructor hangs off both LMS Course and LMS Batch; Has Role hangs
		# off User. Those three parents are what a tagging or a role grant saves.
		from lms.raven_provider import TRIGGERS

		for parent in ("LMS Course", "LMS Batch", "User"):
			self.assertIn(parent, TRIGGERS)


class TestRulePerformance(FrappeTestCase):
	"""Task 17: default_evaluator for 'Students of Batches' must return under 200ms for 1000 members.

	The budget depends on the (batch, member) index added by
	lms.patches.v2_0.add_batch_enrollment_index. Without it the query is a full table
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

		# bulk_insert, not per-row insert(). 1000 ORM inserts takes minutes.
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
		# Set-based cleanup. The ORM would issue 1000 separate deletes.
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
			"rule_type": "Student",
			"student_scope": "Enrolled",
			"enrolled_in": "Batches",
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
			f"default_evaluator took {elapsed * 1000:.1f}ms. Exceeds {self._THRESHOLD_SEC * 1000:.0f}ms "
			f"threshold. Check that lms.patches.v2_0.add_batch_enrollment_index has run.",
		)


class TestGetRavenSetup(UnitTestCase):
	"""Settings > Raven asks LMS, not raven_integration, whether raven_integration is
	there. A method of an uninstalled app raises AppNotInstalledError, and the panel
	that exists to say "install it" cannot render off an exception. Schema-free, so
	UnitTestCase.
	"""

	def setUp(self):
		self._installed = frappe.get_installed_apps

	def tearDown(self):
		frappe.get_installed_apps = self._installed
		sys.modules.pop("raven_integration.api", None)

	def _patch_apps(self, apps):
		frappe.get_installed_apps = lambda *a, **k: apps

	def test_reports_missing_apps_without_importing_them(self):
		self._patch_apps(["frappe", "lms"])
		blocked = ("raven_integration", "raven_integration.api")
		saved = {name: sys.modules.get(name) for name in blocked}
		# A None entry makes the import machinery raise ImportError, exactly as an
		# uninstalled app does. The test fails loudly if the delegation runs.
		for name in blocked:
			sys.modules[name] = None
		try:
			state = raven_provider.get_raven_setup()
		finally:
			for name, original in saved.items():
				if original is None:
					sys.modules.pop(name, None)
				else:
					sys.modules[name] = original

		self.assertEqual(state, {"raven": False, "raven_integration": False, "enabled": False})

	def test_reports_raven_missing_on_its_own(self):
		self._patch_apps(["frappe", "lms", "raven_integration"])
		state = raven_provider.get_raven_setup()
		self.assertFalse(state["raven"])
		self.assertTrue(state["raven_integration"])
		self.assertFalse(state["enabled"])

	def test_delegates_once_both_apps_are_installed(self):
		self._patch_apps(["frappe", "lms", "raven", "raven_integration"])
		stub = types.ModuleType("raven_integration.api")
		stub.is_setup = lambda: {"raven": True, "raven_integration": True, "enabled": True}
		sys.modules["raven_integration.api"] = stub

		state = raven_provider.get_raven_setup()

		self.assertTrue(state["enabled"])

	def test_gate_follows_the_manager_roles_hook(self):
		"""The Settings modal is open to Moderators, so this must be too. The role
		list has to come from the hook, or it drifts from raven_integration's own gate.
		"""
		self._patch_apps(["frappe", "lms"])
		real_only_for = frappe.only_for
		real_get_hooks = frappe.get_hooks
		seen = []

		def fake_hooks(hook=None, *args, **kwargs):
			if hook == "raven_integration_manager_roles":
				return ["Moderator"]
			return real_get_hooks(hook, *args, **kwargs)

		frappe.only_for = lambda roles, *a, **k: seen.append(roles)
		frappe.get_hooks = fake_hooks
		try:
			raven_provider.get_raven_setup()
		finally:
			frappe.only_for = real_only_for
			frappe.get_hooks = real_get_hooks

		self.assertEqual(seen, [["System Manager", "Moderator"]])
