# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe

from lms.lms.permissions import (
	ASSESSMENT_DOCTYPES,
	can_access_assessment,
	can_administer_assessment,
	get_locked_lessons,
)
from lms.lms.test_helpers import BaseTestUtils

ACCESS_HOOK = "lms.lms.permissions.assessment_has_permission"
QUERY_HOOKS = {
	"LMS Quiz": "lms.lms.permissions.quiz_query_conditions",
	"LMS Assignment": "lms.lms.permissions.assignment_query_conditions",
	"LMS Programming Exercise": "lms.lms.permissions.programming_exercise_query_conditions",
}


def framework_allows(doctype: str, name: str, user: str, ptype: str = "read") -> bool:
	"""frappe's own answer for one document. Goes through frappe.has_permission with
	a real document rather than calling the predicate, so it exercises the actual
	hooks.py registration and not just the function it points at."""
	return bool(frappe.has_permission(doctype, ptype, doc=name, user=user))


def lists_for(doctype: str, name: str, user: str) -> bool:
	"""Whether `user` finds `name` in the doctype's list, through the registered
	condition. frappe.get_list, never frappe.get_all, which bypasses permissions;
	limit_page_length=0 since the shared site's default page could drop the row."""
	original_user = frappe.session.user
	frappe.set_user(user)
	try:
		return name in frappe.get_list(doctype, pluck="name", limit_page_length=0)
	finally:
		frappe.set_user(original_user)


class TestAssessmentPairIsRegistered(BaseTestUtils):
	"""Both halves or neither, read off lms.hooks rather than off this file."""

	def test_both_halves_name_all_three_assessment_doctypes(self):
		from lms import hooks

		for doctype in ASSESSMENT_DOCTYPES:
			with self.subTest(doctype=doctype):
				self.assertEqual(hooks.has_permission.get(doctype), ACCESS_HOOK)
				self.assertEqual(hooks.permission_query_conditions.get(doctype), QUERY_HOOKS[doctype])

	def test_every_registered_target_resolves_to_a_callable(self):
		"""A hook is a dotted string, so a rename that misses it fails only at runtime."""
		for doctype in ASSESSMENT_DOCTYPES:
			with self.subTest(doctype=doctype):
				self.assertTrue(callable(frappe.get_attr(ACCESS_HOOK)))
				self.assertTrue(callable(frappe.get_attr(QUERY_HOOKS[doctype])))

	def test_the_live_registry_carries_them_and_not_just_the_module(self):
		"""hooks.py is read through frappe.get_hooks, which caches in redis per site."""
		registered_conditions = frappe.get_hooks("permission_query_conditions") or {}
		registered_documents = frappe.get_hooks("has_permission") or {}
		for doctype in ASSESSMENT_DOCTYPES:
			with self.subTest(doctype=doctype):
				self.assertIn(QUERY_HOOKS[doctype], registered_conditions.get(doctype, []))
				self.assertIn(ACCESS_HOOK, registered_documents.get(doctype, []))


class TestAssessmentRegistrationAgreement(BaseTestUtils):
	"""The two layers, measured through frappe rather than through the predicate:
	the document gate, the list gate, the predicate and the SQL, held to one answer."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.suffix = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"areg-instr-{self.suffix}@example.com", "Ivy", "Instructor", ["Course Creator"]
		)
		self.author = self._create_user(
			f"areg-author-{self.suffix}@example.com", "Amy", "Author", ["Course Creator"]
		)
		self.member = self._create_user(
			f"areg-member-{self.suffix}@example.com", "Mel", "Member", ["LMS Student"]
		)
		self.outsider = self._create_user(
			f"areg-outsider-{self.suffix}@example.com", "Ove", "Outsider", ["LMS Student"]
		)
		self.course = self._create_course(
			title=f"Registered Course {self.suffix}", instructor=self.instructor.name
		)
		self.questions = self._create_quiz_questions()
		self.quiz = self._create_quiz(self.questions, title=f"Registered Quiz {self.suffix}")
		self.assignment = self._create_assignment(title=f"Registered Assignment {self.suffix}")
		self.exercise = self._create_programming_exercise(title=f"Registered Exercise {self.suffix}")
		frappe.db.set_value("LMS Quiz", self.quiz.name, "owner", self.author.name)
		self._set_authors("LMS Quiz", self.quiz.name, [self.author.name])
		self._create_enrollment(self.member.name, self.course.name)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _assessments(self):
		return (
			("LMS Quiz", self.quiz.name),
			("LMS Assignment", self.assignment.name),
			("LMS Programming Exercise", self.exercise.name),
		)

	def _actors(self):
		return (self.member.name, self.outsider.name, self.instructor.name, self.author.name)

	# --- the controls, read before any count ---

	def test_the_actors_hold_the_roles_the_refusals_rest_on(self):
		"""A fixed-key fixture hands back an existing row, so declared roles are
		decoration until they are read. A Moderator is unrestricted by this rule and
		would make every refusal below meaningless."""
		for user in (self.member, self.outsider, self.instructor, self.author):
			self.assertNotIn("Moderator", frappe.get_roles(user.name), user.name)
		self.assertEqual(frappe.db.get_value("LMS Quiz", self.quiz.name, "owner"), self.author.name)

	def test_the_students_docperm_read_still_grants_the_doctype(self):
		"""The refusals below are the pair talking and not a missing grant: without a
		site-wide LMS Student read on all three there would be nothing to narrow."""
		for doctype, _name in self._assessments():
			with self.subTest(doctype=doctype):
				self.assertTrue(frappe.has_permission(doctype, "read", user=self.outsider.name))

	# --- four callers on both paths ---

	def test_the_placed_assessment_reaches_its_course_and_nobody_else(self):
		for doctype, name in self._assessments():
			self._place_in_lesson(self.course.name, doctype, name)
			with self.subTest(doctype=doctype):
				self.assertTrue(framework_allows(doctype, name, self.member.name))
				self.assertTrue(framework_allows(doctype, name, self.instructor.name))
				self.assertFalse(framework_allows(doctype, name, self.outsider.name))
				self.assertTrue(lists_for(doctype, name, self.member.name))
				self.assertFalse(lists_for(doctype, name, self.outsider.name))

	def test_guest_reaches_nothing_on_either_path(self):
		"""Guest is a real user and is passed as the literal string, not as None."""
		for doctype, name in self._assessments():
			self._place_in_lesson(self.course.name, doctype, name)
			with self.subTest(doctype=doctype):
				self.assertFalse(framework_allows(doctype, name, "Guest"))
				self.assertFalse(can_access_assessment(doctype, name, user="Guest"))

	def test_a_malformed_name_is_refused_by_the_document_gate(self):
		self.assertFalse(can_access_assessment("LMS Quiz", None, user=self.member.name))
		self.assertFalse(can_access_assessment("LMS Quiz", {"title": ("like", "%")}, user=self.member.name))

	def test_a_doctype_the_hook_does_not_gate_gets_no_opinion(self):
		"""The hook is registered for three doctypes and reads the doctype off the doc,
		so anything else must pass through rather than be refused — a hook that denied
		by default would take away access LMS never granted itself."""
		from lms.lms.permissions import assessment_has_permission

		course = frappe.get_doc("LMS Course", self.course.name)
		self.assertTrue(assessment_has_permission(course, "read", self.outsider.name))

	# --- the two-layer agreement, per actor ---

	def test_the_document_gate_and_the_predicate_agree_for_every_actor(self):
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		self._place_in_lesson(self.course.name, "LMS Assignment", self.assignment.name)
		self._place_in_lesson(self.course.name, "LMS Programming Exercise", self.exercise.name)
		for doctype, name in self._assessments():
			for actor in self._actors():
				self.assertEqual(
					can_access_assessment(doctype, name, user=actor),
					framework_allows(doctype, name, actor),
					f"{actor} gets different answers from the predicate and the hook for {doctype}",
				)

	def test_the_list_gate_and_the_document_gate_agree_for_every_actor(self):
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		self._place_in_lesson(self.course.name, "LMS Assignment", self.assignment.name)
		self._place_in_lesson(self.course.name, "LMS Programming Exercise", self.exercise.name)
		for doctype, name in self._assessments():
			for actor in self._actors():
				self.assertEqual(
					framework_allows(doctype, name, actor),
					lists_for(doctype, name, actor),
					f"{actor} gets different answers from the two layers for {doctype}",
				)

	def test_an_unplaced_assessment_agrees_on_both_layers_too(self):
		"""The floor: with no placement anywhere the author reaches it and nobody else
		does, on the document gate and on the list gate alike."""
		for doctype, name in self._assessments():
			with self.subTest(doctype=doctype):
				owner = frappe.db.get_value(doctype, name, "owner")
				self.assertTrue(framework_allows(doctype, name, owner))
				self.assertTrue(lists_for(doctype, name, owner))
				self.assertFalse(framework_allows(doctype, name, self.member.name))
				self.assertFalse(lists_for(doctype, name, self.member.name))

	# --- the ptype split ---

	def test_an_enrolled_member_reads_the_quiz_and_may_not_write_it(self):
		"""read takes the member reading, everything else takes the instructor one."""
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		self.assertTrue(framework_allows("LMS Quiz", self.quiz.name, self.member.name, "read"))
		self.assertFalse(framework_allows("LMS Quiz", self.quiz.name, self.member.name, "write"))
		self.assertFalse(framework_allows("LMS Quiz", self.quiz.name, self.member.name, "delete"))
		self.assertFalse(can_administer_assessment("LMS Quiz", self.quiz.name, user=self.member.name))

	def test_the_course_instructor_writes_the_quiz_placed_in_their_course(self):
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		self.assertTrue(framework_allows("LMS Quiz", self.quiz.name, self.instructor.name, "write"))

	def test_a_course_creator_with_no_relationship_may_no_longer_write_it(self):
		"""Course Creator holds write on all three site-wide; after registration it
		reaches only what it can administer, and the row is still there afterwards."""
		stranger = self._create_user(
			f"areg-stranger-{self.suffix}@example.com", "Sid", "Stranger", ["Course Creator"]
		)
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		self.assertTrue(frappe.has_permission("LMS Quiz", "write", user=stranger.name))
		self.assertFalse(framework_allows("LMS Quiz", self.quiz.name, stranger.name, "write"))
		self.assertFalse(lists_for("LMS Quiz", self.quiz.name, stranger.name))
		self.assertTrue(frappe.db.exists("LMS Quiz", self.quiz.name))

	def test_create_returns_no_opinion_and_the_docperm_grant_governs(self):
		"""An assessment's scope lives in rows that name it, and a document being
		inserted has no name for them to point at. So create is the DocPerm's to
		answer, and a Course Creator who is nobody's instructor still creates one."""
		stranger = self._create_user(
			f"areg-maker-{self.suffix}@example.com", "Cal", "Creator", ["Course Creator"]
		)
		frappe.set_user(stranger.name)
		try:
			quiz = frappe.get_doc(
				{"doctype": "LMS Quiz", "title": f"Created By A Stranger {self.suffix}"}
			).insert()
		finally:
			frappe.set_user("Administrator")
		self.assertTrue(frappe.db.exists("LMS Quiz", quiz.name))
		self.assertEqual(frappe.db.get_value("LMS Quiz", quiz.name, "owner"), stranger.name)

	def test_a_doc_less_check_never_reaches_the_hook(self):
		"""frappe.has_permission with no `doc` goes straight to the DocPerm table and
		never reaches this hook -- that is the role's answer, not this rule's."""
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		self.assertTrue(frappe.has_permission("LMS Quiz", "read", user=self.outsider.name))
		self.assertFalse(framework_allows("LMS Quiz", self.quiz.name, self.outsider.name))


class TestSequentialLockDivergence(BaseTestUtils):
	"""The one place the two layers disagree, and it is accepted: get_locked_lessons
	is not a WHERE fragment, so a locked lesson's quiz is listed but refused on open,
	the same split Course Lesson's own query condition already makes."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.suffix = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"alock-instr-{self.suffix}@example.com", "Ivy", "Instructor", ["Course Creator"]
		)
		self.member = self._create_user(
			f"alock-member-{self.suffix}@example.com", "Mel", "Member", ["LMS Student"]
		)
		self.course = self._create_course(
			title=f"Locked Course {self.suffix}", instructor=self.instructor.name
		)
		self.questions = self._create_quiz_questions()
		self.quiz = self._create_quiz(self.questions, title=f"Locked Quiz {self.suffix}")
		self._create_enrollment(self.member.name, self.course.name)
		self.locked_lesson = self._lock_the_quiz_behind_an_earlier_lesson()

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _lock_the_quiz_behind_an_earlier_lesson(self) -> str:
		"""Put the quiz in the second lesson of a course that enforces completion.

		The lock rule reads the ordered lesson list, which comes from the reference
		tables and not from Course Lesson.chapter, so both chapters need a Chapter
		Reference row for an order to exist at all.
		"""
		first_chapter = self._create_chapter(f"Lock Chapter {self.suffix}", self.course.name)
		first_lesson = self._create_lesson(f"Lock Lesson {self.suffix}", first_chapter.name, self.course.name)
		self._create_chapter_reference(self.course.name, first_chapter.name, idx=1)
		self._create_lesson_reference(first_chapter.name, first_lesson.name)
		placed = self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		self._create_chapter_reference(self.course.name, placed.chapter, idx=2)
		self._create_lesson_reference(placed.chapter, placed.name)
		frappe.db.set_value("LMS Course", self.course.name, "enforce_lesson_completion", 1)
		return placed.name

	def test_the_lesson_is_locked_for_the_member(self):
		"""Read before the divergence: an unlocked lesson would make it vanish."""
		frappe.set_user(self.member.name)
		try:
			self.assertIn(self.locked_lesson, get_locked_lessons(self.course.name))
		finally:
			frappe.set_user("Administrator")

	def test_the_locked_quiz_is_listed_and_refused_on_open(self):
		self.assertTrue(
			lists_for("LMS Quiz", self.quiz.name, self.member.name),
			"the list layer cannot express the lock, so the row is expected to be listed",
		)
		self.assertFalse(
			framework_allows("LMS Quiz", self.quiz.name, self.member.name),
			"the document gate applies the lock, so opening it is expected to be refused",
		)

	def test_completing_the_earlier_lesson_closes_the_divergence(self):
		"""The divergence is the lock's, not the rule's: with nothing locked the two
		layers agree again, which is what makes this a gap and not a contradiction."""
		for lesson in frappe.get_all("Course Lesson", filters={"course": self.course.name}, pluck="name"):
			progress = self._create_progress(self.member.name, self.course.name, lesson)
			frappe.db.set_value("LMS Course Progress", progress.name, "status", "Complete")
		self.assertTrue(lists_for("LMS Quiz", self.quiz.name, self.member.name))
		self.assertTrue(framework_allows("LMS Quiz", self.quiz.name, self.member.name))
