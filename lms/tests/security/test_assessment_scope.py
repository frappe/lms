# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

from contextlib import contextmanager

import frappe

from lms.lms.permissions import (
	_assessment_query_conditions,
	can_access_assessment,
	can_access_quiz,
	get_locked_lessons,
)
from lms.lms.test_helpers import BaseTestUtils

# What Task 10 will write into hooks.py. Held here so the list assertions measure the
# SQL this commit writes rather than waiting on a registration in a later commit.
ASSESSMENT_QUERY_CONDITIONS = {
	"LMS Quiz": ["lms.lms.permissions.quiz_query_conditions"],
	"LMS Assignment": ["lms.lms.permissions.assignment_query_conditions"],
	"LMS Programming Exercise": ["lms.lms.permissions.programming_exercise_query_conditions"],
}


@contextmanager
def conditions_registered():
	"""Apply the query conditions to frappe.get_list without touching hooks.py.

	db_query reads the mapping through frappe.get_hooks and resolves each entry with
	frappe.get_attr, so overriding that one hook is the whole of what registration does
	to a list query. Every other hook still answers from the real registry.
	"""
	real_get_hooks = frappe.get_hooks

	def get_hooks(hook=None, default="_KEEP_DEFAULT_LIST", app_name=None):
		hooks = real_get_hooks(hook, default, app_name)
		if hook != "permission_query_conditions":
			return hooks
		return {**(hooks or {}), **ASSESSMENT_QUERY_CONDITIONS}

	frappe.get_hooks = get_hooks
	try:
		yield
	finally:
		frappe.get_hooks = real_get_hooks


def lists_for(doctype: str, name: str, user: str) -> bool:
	"""Whether `user` finds `name` in the doctype's list, with the condition applied.

	frappe.get_list and never frappe.get_all, which sets ignore_permissions=True and
	would pass against a condition that does nothing. limit_page_length=0 because the
	site is shared: the default page of 20 rows would drop the row under test on
	volume and read as a refusal.
	"""
	original_user = frappe.session.user
	frappe.set_user(user)
	try:
		with conditions_registered():
			return name in frappe.get_list(doctype, pluck="name", limit_page_length=0)
	finally:
		frappe.set_user(original_user)


class TestAssessmentPlacementAccess(BaseTestUtils):
	"""Who reaches an assessment through the lesson that places it.

	The single-Link LMS Quiz.course/.lesson stamp this replaces modelled an N:M
	relation with one value, had no counterpart on LMS Programming Exercise at all,
	and was written from a lesson's instructor notes without marking it — so a quiz
	only an instructor was meant to see was served to every enrolled member.
	"""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		suffix = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"aps-instr-{suffix}@example.com", "Ivy", "Instructor", ["Course Creator"]
		)
		self.author = self._create_user(
			f"aps-author-{suffix}@example.com", "Amy", "Author", ["Course Creator"]
		)
		self.member = self._create_user(f"aps-member-{suffix}@example.com", "Mel", "Member", ["LMS Student"])
		self.outsider = self._create_user(
			f"aps-outsider-{suffix}@example.com", "Ove", "Outsider", ["LMS Student"]
		)

		self.course = self._create_course(title=f"Placement Course {suffix}", instructor=self.instructor.name)
		self.questions = self._create_quiz_questions()
		self.quiz = self._create_quiz(self.questions, title=f"Placement Quiz {suffix}")
		self.assignment = self._create_assignment(title=f"Placement Assignment {suffix}")
		self.exercise = self._create_programming_exercise(title=f"Placement Exercise {suffix}")
		frappe.db.set_value("LMS Quiz", self.quiz.name, "owner", self.author.name)
		self._create_enrollment(self.member.name, self.course.name)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	# --- the controls, read before any count ---

	def test_the_actors_hold_the_roles_the_refusals_rest_on(self):
		"""A fixed-key fixture returns the existing row untouched, so its declared roles
		are decoration. A refusal by a Moderator would prove nothing about placement."""
		self.assertNotIn("Moderator", frappe.get_roles(self.member.name))
		self.assertNotIn("Moderator", frappe.get_roles(self.outsider.name))
		self.assertNotIn("Moderator", frappe.get_roles(self.instructor.name))
		self.assertEqual(frappe.db.get_value("LMS Quiz", self.quiz.name, "owner"), self.author.name)

	def test_an_unplaced_assessment_reaches_only_its_author(self):
		"""The floor every other case is measured against: with no placement anywhere,
		the author reaches it and nobody else does. The fix cannot move this."""
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=self.author.name))
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user="Administrator"))
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.member.name))
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.instructor.name))

	def test_a_name_that_is_not_a_string_is_refused(self):
		self.assertFalse(can_access_assessment("LMS Quiz", None, user=self.member.name))
		self.assertFalse(can_access_assessment("LMS Quiz", {"title": ("like", "%")}, user=self.member.name))

	def test_a_doctype_that_is_not_an_assessment_is_refused(self):
		self.assertFalse(can_access_assessment("LMS Course", self.course.name, user="Administrator"))

	# --- the regression this commit closes ---

	def test_a_saved_lesson_places_its_quiz_for_the_course_it_is_in(self):
		"""A lesson save writes placement rows, and on this base it also still writes
		the legacy stamp beside them — PR 5 kept that deliberately, and the assertion
		is here so a later change cannot retire the stamp without this suite noticing."""
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		self.assertEqual(frappe.db.get_value("LMS Quiz", self.quiz.name, "course"), self.course.name)
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=self.instructor.name))
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=self.member.name))
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.outsider.name))

	def test_the_old_quiz_gate_reads_one_placement_where_the_table_holds_many(self):
		"""`can_access_quiz` is the develop-era gate and this PR deliberately leaves it
		alone, so the two readings of "may this user reach this quiz" are measurably
		different. The single `LMS Quiz.course` Link holds one value for a quiz that can
		sit in many courses, and the last lesson saved wins; the placement table holds
		one row per placement and has no winner.

		Tier 4 PR 7 collapses `can_access_quiz` into the new predicate. Repointing it
		here would be an unannounced behaviour change on two live whitelisted endpoints
		(`lms_quiz.py:203`, `utils.py:1975`) in a PR that registers nothing.
		"""
		other_course = self._create_course(
			title=f"Second Gate {self.course.name}", instructor=self.author.name
		)
		self._create_enrollment(self.member.name, other_course.name)
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		self._place_in_lesson(other_course.name, "LMS Quiz", self.quiz.name)
		self.assertEqual(
			frappe.db.get_value("LMS Quiz", self.quiz.name, "course"),
			other_course.name,
			"the stamp does not name the last course saved, so this fixture proves nothing",
		)

		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=self.instructor.name))
		self.assertFalse(can_access_quiz(self.quiz.name, user=self.instructor.name))

	def test_the_old_quiz_gate_grants_an_instructor_only_quiz_this_one_refuses(self):
		"""A live bug on develop, pinned rather than fixed here.

		`validate_quiz_id` stamps `LMS Quiz.course` from `instructor_content` as well as
		`content` and marks the two identically (`course_lesson.py:86-90`), and
		`can_access_quiz` reads that stamp as a student placement — so every enrolled
		member of the course reaches a quiz embedded only in a lesson's instructor
		notes. `can_access_assessment` reads the same stamp as an author-only course and
		refuses them.

		The stamp keeps being written: `LMS Quiz Submission.course` has
		`fetch_from: quiz.course`, so retiring the write would silently NULL a column on
		another doctype. The fix is on the reading side, which is what this branch
		changed. When PR 7 repoints `can_access_quiz`, the second assertion becomes
		`assertFalse` and this test becomes an ordinary agreement test.
		"""
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name, instructor_only=True)
		self.assertEqual(
			frappe.db.get_value("LMS Quiz", self.quiz.name, "course"),
			self.course.name,
			"the instructor-only save did not stamp the quiz, so this measures nothing",
		)
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.member.name))
		self.assertTrue(can_access_quiz(self.quiz.name, user=self.member.name))

	def test_an_assignment_placement_grants_an_enrolled_member(self):
		self._place_in_lesson(self.course.name, "LMS Assignment", self.assignment.name)
		self.assertTrue(can_access_assessment("LMS Assignment", self.assignment.name, user=self.member.name))
		self.assertFalse(
			can_access_assessment("LMS Assignment", self.assignment.name, user=self.outsider.name)
		)

	def test_a_programming_exercise_now_has_a_course_placement(self):
		"""LMS Programming Exercise has no course field at all, so before the table only
		a batch could ever grant one. This is the case that made registering its query
		condition unsafe."""
		self._place_in_lesson(self.course.name, "LMS Programming Exercise", self.exercise.name)
		self.assertTrue(
			can_access_assessment("LMS Programming Exercise", self.exercise.name, user=self.member.name)
		)
		self.assertFalse(
			can_access_assessment("LMS Programming Exercise", self.exercise.name, user=self.outsider.name)
		)

	def test_an_in_video_quiz_is_reachable(self):
		"""Nothing ever placed an in-video quiz: save_lesson_details_in_quiz read the
		quiz block only, so these carried a NULL stamp from day one."""
		content = frappe.as_json(
			{"blocks": [{"type": "upload", "data": {"quizzes": [{"quiz": self.quiz.name}]}}]}
		)
		chapter = self._create_chapter("In-video Chapter", self.course.name)
		self._create_lesson("In-video Lesson", chapter.name, self.course.name, content)
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=self.member.name))

	def test_one_quiz_placed_in_two_courses_is_reachable_from_either(self):
		"""The relation the single Link could not hold: whichever lesson was saved last
		won, and every member of the other course lost the quiz."""
		other_course = self._create_course(title=f"Second {self.course.name}", instructor=self.author.name)
		other_member = self._create_user(
			f"aps-second-{frappe.generate_hash(length=6)}@example.com", "Sal", "Second", ["LMS Student"]
		)
		self._create_enrollment(other_member.name, other_course.name)
		first = self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		second = self._place_in_lesson(other_course.name, "LMS Quiz", self.quiz.name)

		self.assertNotEqual(first.name, second.name, "both placements collapsed onto one lesson")
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=self.member.name))
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=other_member.name))

	# --- instructor-only placements ---

	def test_an_instructor_only_placement_denies_an_enrolled_student(self):
		"""The rule the placement table exists for, and the reason the legacy stamp is
		read as an author-only course: the lesson save stamps this quiz from
		`instructor_content` exactly as it would from `content`, so reading the stamp as
		a student placement would grant the member here and the flag would be inert."""
		lesson = self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name, instructor_only=True)
		self.assertEqual(
			frappe.db.get_value("LMS Quiz", self.quiz.name, "course"),
			self.course.name,
			"the lesson save did not stamp the quiz, so this does not measure the stamp being read",
		)
		self.assertEqual(
			frappe.db.get_value(
				"LMS Lesson Assessment",
				{"parent": lesson.name, "assessment_name": self.quiz.name},
				"instructor_only",
			),
			1,
			"the fixture placed a student-visible row, so the refusal proves nothing",
		)
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.member.name))

	def test_an_instructor_only_placement_grants_the_course_instructor(self):
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name, instructor_only=True)
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=self.instructor.name))
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.outsider.name))

	def test_an_instructor_only_placement_follows_the_chapter_not_the_mirror(self):
		"""R-20. Course Lesson.course is a copy-on-save fetch_from mirror, so a chapter
		re-pointed at another course leaves every lesson under it naming the course it
		has left — and an instructor_only placement read off that grants the departed
		course's author and refuses the arrived course's own."""
		arrived_instructor = self._create_user(
			f"aps-arrived-{frappe.generate_hash(length=6)}@example.com", "Ben", "Arrived", ["Course Creator"]
		)
		arrived_course = self._create_course(
			title=f"Arrived {self.course.name}", instructor=arrived_instructor.name
		)
		lesson = self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name, instructor_only=True)

		chapter = frappe.get_doc("Course Chapter", lesson.chapter)
		chapter.course = arrived_course.name
		chapter.save()
		self.assertEqual(
			frappe.db.get_value("Course Lesson", lesson.name, "course"),
			self.course.name,
			"the mirror refreshed itself, so this fixture proves nothing",
		)

		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=arrived_instructor.name))
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.instructor.name))

	# --- the legacy stamp, read as an author-only course ---

	def test_the_legacy_stamp_grants_the_course_author_and_not_its_members(self):
		"""Lessons saved before the placement table have no rows, only the frozen stamp.
		Without this fallback the gate denies the authors of every already-embedded
		assessment in the wild.

		It grants an author and nobody else, because the stamp does not say whether the
		lesson embedded the quiz in its content or in its instructor notes — the save
		writes the same two columns either way. A member reaches an assessment through a
		placement row, which does carry that distinction.
		"""
		self._stamp_legacy_quiz_placement(self.quiz.name, self.course.name)
		self.assertFalse(
			frappe.db.exists("LMS Lesson Assessment", {"assessment_name": self.quiz.name}),
			"a placement row exists, so this is not measuring the legacy path",
		)
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=self.instructor.name))
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.member.name))
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.outsider.name))

	def test_the_legacy_assignment_course_field_grants_the_author_and_not_its_members(self):
		"""LMS Assignment.course is author-picked and no lesson save writes it, so it
		carries no instructor-notes hazard of its own. It is read the same way anyway:
		one reading of "the stamp" is cheaper to hold than two, and after PR 5's
		backfill an assignment actually embedded in a lesson is reached by its row."""
		frappe.db.set_value("LMS Assignment", self.assignment.name, "course", self.course.name)
		self.assertTrue(
			can_access_assessment("LMS Assignment", self.assignment.name, user=self.instructor.name)
		)
		self.assertFalse(can_access_assessment("LMS Assignment", self.assignment.name, user=self.member.name))
		self.assertFalse(
			can_access_assessment("LMS Assignment", self.assignment.name, user=self.outsider.name)
		)


class TestAssessmentBatchAccess(BaseTestUtils):
	"""The batch branch, which R-24 settles: an evaluator of a batch may read the
	answer keys of the assessments that batch runs.

	It is pinned here because generalising the gate is where it could be reversed by
	accident — the branch used to hard-code assessment_type="LMS Quiz", so carrying
	the doctype under test is the difference between granting and silently refusing.
	"""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		suffix = frappe.generate_hash(length=6)
		# validate_instructor_roles requires the Batch Evaluator role of a batch
		# instructor. The tag, not the role, is what can_modify_batch reads.
		self.instructor = self._create_user(
			f"abs-instr-{suffix}@example.com", "Ivo", "Instructor", ["Course Creator", "Batch Evaluator"]
		)
		self.evaluator = self._create_user(
			f"abs-eval-{suffix}@example.com", "Eve", "Evaluator", ["Batch Evaluator"]
		)
		self.other_evaluator = self._create_user(
			f"abs-other-{suffix}@example.com", "Oli", "Other", ["Batch Evaluator"]
		)
		self.questions = self._create_quiz_questions()
		self.quiz = self._create_quiz(self.questions, title=f"Batch Quiz {suffix}")
		self.exercise = self._create_programming_exercise(title=f"Batch Exercise {suffix}")
		self.course = self._create_course(title=f"Batch Course {suffix}", instructor=self.instructor.name)
		self._create_evaluator(self.evaluator.name)
		self._create_evaluator(self.other_evaluator.name)
		self.batch = self._create_batch(f"Assessed {suffix}", self.evaluator.name, assessed=True)
		self.other_batch = self._create_batch(f"Bare {suffix}", self.other_evaluator.name, assessed=False)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _create_batch(self, title, evaluator, assessed):
		assessments = [
			{"assessment_type": "LMS Quiz", "assessment_name": self.quiz.name},
			{"assessment_type": "LMS Programming Exercise", "assessment_name": self.exercise.name},
		]
		batch = frappe.get_doc(
			{
				"doctype": "LMS Batch",
				"title": title,
				"start_date": frappe.utils.nowdate(),
				"end_date": frappe.utils.add_days(frappe.utils.nowdate(), 10),
				"start_time": "09:00:00",
				"end_time": "11:00:00",
				"timezone": "Asia/Kolkata",
				"description": f"A batch for {title}",
				"batch_details": f"Details of {title}",
				"instructors": [{"instructor": self.instructor.name}],
				"courses": [{"course": self.course.name, "evaluator": evaluator}],
				"assessment": assessments if assessed else [],
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - fixture setup as Administrator; the batch gate is not what this suite measures
		batch.insert(ignore_permissions=True)
		return batch

	def test_the_evaluator_is_tagged_on_the_batch_and_holds_no_moderator_role(self):
		"""The control. can_modify_batch grants the tag, not the role, and a Moderator
		would be granted by a branch this suite is not about."""
		self.assertNotIn("Moderator", frappe.get_roles(self.evaluator.name))
		self.assertTrue(
			frappe.db.exists(
				"Batch Course",
				{"evaluator": self.evaluator.name, "parent": self.batch.name, "parenttype": "LMS Batch"},
			)
		)

	def test_a_batch_evaluator_reads_the_quiz_of_a_batch_they_evaluate(self):
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=self.evaluator.name))

	def test_a_batch_evaluator_reads_the_programming_exercise_of_that_batch(self):
		"""The branch filtered on assessment_type="LMS Quiz" literally, so every
		non-quiz assessment fell out of it in the direction that refuses."""
		self.assertTrue(
			can_access_assessment("LMS Programming Exercise", self.exercise.name, user=self.evaluator.name)
		)

	def test_an_evaluator_of_a_batch_that_does_not_run_it_is_refused(self):
		"""The grant is the batch's assessment list, not the Batch Evaluator role."""
		self.assertTrue(
			frappe.db.exists(
				"Batch Course",
				{
					"evaluator": self.other_evaluator.name,
					"parent": self.other_batch.name,
					"parenttype": "LMS Batch",
				},
			),
			"the other evaluator is tagged on no batch, so the refusal proves nothing",
		)
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.other_evaluator.name))

	# --- the same branch on the list read ---

	def test_a_batch_evaluator_lists_the_quiz_of_a_batch_they_evaluate(self):
		self.assertTrue(lists_for("LMS Quiz", self.quiz.name, self.evaluator.name))

	def test_a_batch_evaluator_lists_the_programming_exercise_of_that_batch(self):
		"""The clause carries the doctype under test rather than the literal "LMS Quiz"
		the predicate half was written with. Hard-coding it fails in the refusing
		direction, which is the direction that says nothing when it is wrong."""
		self.assertTrue(lists_for("LMS Programming Exercise", self.exercise.name, self.evaluator.name))

	def test_an_evaluator_of_a_batch_that_does_not_run_it_lists_nothing(self):
		self.assertFalse(lists_for("LMS Quiz", self.quiz.name, self.other_evaluator.name))
		self.assertFalse(lists_for("LMS Programming Exercise", self.exercise.name, self.other_evaluator.name))

	def test_the_batch_instructor_lists_it(self):
		self.assertTrue(lists_for("LMS Quiz", self.quiz.name, self.instructor.name))

	def test_a_student_enrolled_in_the_batch_lists_it(self):
		student = self._create_user(
			f"abs-student-{frappe.generate_hash(length=6)}@example.com", "Sam", "Student", ["LMS Student"]
		)
		self._create_batch_enrollment(student.name, self.batch.name)
		self.assertTrue(lists_for("LMS Quiz", self.quiz.name, student.name))
		self.assertFalse(lists_for("LMS Quiz", self.quiz.name, self.other_evaluator.name))

	def test_the_two_layers_agree_for_every_batch_actor(self):
		student = self._create_user(
			f"abs-agree-{frappe.generate_hash(length=6)}@example.com", "Ana", "Agree", ["LMS Student"]
		)
		self._create_batch_enrollment(student.name, self.batch.name)
		actors = [self.evaluator.name, self.other_evaluator.name, self.instructor.name, student.name]
		for doctype, name in (("LMS Quiz", self.quiz.name), ("LMS Programming Exercise", self.exercise.name)):
			for actor in actors:
				self.assertEqual(
					can_access_assessment(doctype, name, user=actor),
					lists_for(doctype, name, actor),
					f"{actor} gets different answers from the two layers for {doctype} {name}",
				)


class TestAssessmentListScope(BaseTestUtils):
	"""The list half of the same rule, and whether the two halves agree.

	A has_permission hook is never consulted on a list query, so a doctype registered
	for one and not the other reads as protected while /api/resource, reports, exports
	and Data Import still enumerate every row. These are the assertions that hold the
	SQL to the predicate, and every one of them goes through lists_for — frappe.get_all
	sets ignore_permissions=True and would pass against a condition that does nothing.
	"""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.suffix = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"als-instr-{self.suffix}@example.com", "Ivy", "Instructor", ["Course Creator"]
		)
		self.author = self._create_user(
			f"als-author-{self.suffix}@example.com", "Amy", "Author", ["Course Creator"]
		)
		self.member = self._create_user(
			f"als-member-{self.suffix}@example.com", "Mel", "Member", ["LMS Student"]
		)
		self.outsider = self._create_user(
			f"als-outsider-{self.suffix}@example.com", "Ove", "Outsider", ["LMS Student"]
		)
		self.course = self._create_course(title=f"List Course {self.suffix}", instructor=self.instructor.name)
		self.questions = self._create_quiz_questions()
		self.quiz = self._create_quiz(self.questions, title=f"List Quiz {self.suffix}")
		self.assignment = self._create_assignment(title=f"List Assignment {self.suffix}")
		self.exercise = self._create_programming_exercise(title=f"List Exercise {self.suffix}")
		frappe.db.set_value("LMS Quiz", self.quiz.name, "owner", self.author.name)
		self._create_enrollment(self.member.name, self.course.name)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	# --- the controls, read before any count ---

	def test_the_actors_hold_the_roles_the_refusals_rest_on(self):
		for user in (self.member, self.outsider, self.instructor, self.author):
			self.assertNotIn("Moderator", frappe.get_roles(user.name), user.name)
		self.assertEqual(frappe.db.get_value("LMS Quiz", self.quiz.name, "owner"), self.author.name)

	def test_get_all_bypasses_the_condition_that_get_list_enforces(self):
		"""Both halves of the trap this task turns on, in one place.

		Before the condition applies, an outsider lists the quiz — so every refusal
		below is the condition's doing and not a DocPerm's; LMS Student holds read on
		all three doctypes. With it applied, get_list refuses and get_all still returns
		the row, which is what makes a get_all assertion here worthless.
		"""
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		frappe.set_user(self.outsider.name)
		try:
			self.assertIn(
				self.quiz.name,
				frappe.get_list("LMS Quiz", pluck="name", limit_page_length=0),
				"the doctype refuses the outsider before any condition applies",
			)
			with conditions_registered():
				self.assertNotIn(
					self.quiz.name, frappe.get_list("LMS Quiz", pluck="name", limit_page_length=0)
				)
				self.assertIn(self.quiz.name, frappe.get_all("LMS Quiz", pluck="name", limit_page_length=0))
		finally:
			frappe.set_user("Administrator")

	def test_a_doctype_that_is_not_an_assessment_lists_nothing(self):
		"""An empty string means "no restriction" to db_query, so an unknown doctype has
		to refuse rather than return the value a caller might read as allowed."""
		self.assertEqual(_assessment_query_conditions("LMS Course", self.member.name), "1 = 0")

	def test_a_moderator_and_the_administrator_are_unrestricted(self):
		moderator = self._create_user(f"als-mod-{self.suffix}@example.com", "Moe", "Moderator", ["Moderator"])
		self.assertEqual(_assessment_query_conditions("LMS Quiz", moderator.name), "")
		self.assertEqual(_assessment_query_conditions("LMS Quiz", "Administrator"), "")

	# --- course placements ---

	def test_an_enrolled_member_lists_the_quiz_placed_in_their_course(self):
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		self.assertTrue(lists_for("LMS Quiz", self.quiz.name, self.member.name))
		self.assertFalse(lists_for("LMS Quiz", self.quiz.name, self.outsider.name))

	def test_the_course_instructor_lists_it(self):
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		self.assertTrue(lists_for("LMS Quiz", self.quiz.name, self.instructor.name))

	def test_the_author_lists_an_assessment_nothing_places(self):
		"""The floor. With no placement anywhere the row reaches its own owner, so a
		newly created assessment is still editable before it is embedded."""
		self.assertTrue(lists_for("LMS Quiz", self.quiz.name, self.author.name))
		self.assertFalse(lists_for("LMS Quiz", self.quiz.name, self.member.name))
		self.assertFalse(lists_for("LMS Quiz", self.quiz.name, self.instructor.name))

	def test_an_assignment_placement_lists_for_an_enrolled_member(self):
		self._place_in_lesson(self.course.name, "LMS Assignment", self.assignment.name)
		self.assertTrue(lists_for("LMS Assignment", self.assignment.name, self.member.name))
		self.assertFalse(lists_for("LMS Assignment", self.assignment.name, self.outsider.name))

	def test_a_programming_exercise_lists_from_a_course_placement(self):
		"""It has neither a course column nor a lesson one, so until the placement table
		the only clause that could ever list one was the batch's."""
		self._place_in_lesson(self.course.name, "LMS Programming Exercise", self.exercise.name)
		self.assertTrue(lists_for("LMS Programming Exercise", self.exercise.name, self.member.name))
		self.assertFalse(lists_for("LMS Programming Exercise", self.exercise.name, self.outsider.name))

	def test_an_instructor_only_placement_is_hidden_from_the_students_of_its_course(self):
		lesson = self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name, instructor_only=True)
		self.assertEqual(
			frappe.db.get_value(
				"LMS Lesson Assessment",
				{"parent": lesson.name, "assessment_name": self.quiz.name},
				"instructor_only",
			),
			1,
			"the fixture placed a student-visible row, so the refusal proves nothing",
		)
		self.assertFalse(lists_for("LMS Quiz", self.quiz.name, self.member.name))
		self.assertTrue(lists_for("LMS Quiz", self.quiz.name, self.instructor.name))

	def test_a_placement_follows_the_chapter_and_not_the_lesson_mirror(self):
		"""R-20 on the list read. Course Lesson.course is a copy-on-save fetch_from
		mirror a chapter's move leaves naming the course the lesson has left, so a join
		through it lists the assessment for the departed course and hides it from the
		arrived one."""
		arrived_instructor = self._create_user(
			f"als-arrived-{self.suffix}@example.com", "Ben", "Arrived", ["Course Creator"]
		)
		arrived_course = self._create_course(
			title=f"Arrived {self.suffix}", instructor=arrived_instructor.name
		)
		lesson = self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		chapter = frappe.get_doc("Course Chapter", lesson.chapter)
		chapter.course = arrived_course.name
		chapter.save()
		self.assertEqual(
			frappe.db.get_value("Course Lesson", lesson.name, "course"),
			self.course.name,
			"the mirror refreshed itself, so this fixture proves nothing",
		)
		self.assertTrue(lists_for("LMS Quiz", self.quiz.name, arrived_instructor.name))
		self.assertFalse(lists_for("LMS Quiz", self.quiz.name, self.instructor.name))
		self.assertFalse(lists_for("LMS Quiz", self.quiz.name, self.member.name))

	def test_a_quiz_id_lesson_places_the_quiz(self):
		"""Course Lesson.quiz_id is hand-set and nothing auto-populates it, so it leaves
		no placement row behind — and the predicate half reads it as a placement."""
		chapter = self._create_chapter(f"Quiz Id Chapter {self.suffix}", self.course.name)
		lesson = self._create_lesson(f"Quiz Id Lesson {self.suffix}", chapter.name, self.course.name)
		frappe.db.set_value("Course Lesson", lesson.name, "quiz_id", self.quiz.name)
		self.assertFalse(
			frappe.db.exists("LMS Lesson Assessment", {"assessment_name": self.quiz.name}),
			"a placement row exists, so this is not measuring the quiz_id path",
		)
		self.assertTrue(lists_for("LMS Quiz", self.quiz.name, self.member.name))
		self.assertFalse(lists_for("LMS Quiz", self.quiz.name, self.outsider.name))

	# --- the legacy stamp, read as an author-only course ---

	def test_the_legacy_stamp_lists_for_the_course_author_and_not_its_members(self):
		"""The list half of the same reading: the stamp clause is emitted against the
		authored course list only, never the enrolled one."""
		self._stamp_legacy_quiz_placement(self.quiz.name, self.course.name)
		self.assertFalse(
			frappe.db.exists("LMS Lesson Assessment", {"assessment_name": self.quiz.name}),
			"a placement row exists, so this is not measuring the legacy path",
		)
		self.assertTrue(lists_for("LMS Quiz", self.quiz.name, self.instructor.name))
		self.assertFalse(lists_for("LMS Quiz", self.quiz.name, self.member.name))
		self.assertFalse(lists_for("LMS Quiz", self.quiz.name, self.outsider.name))

	def test_the_legacy_lesson_wins_over_the_course_the_stamp_froze(self):
		"""R-20 again, on the half of the stamp that can still be resolved.

		Folding the stamped course in unconditionally hands the departed course's
		instructors an answer key the lesson took with it. The stamped course is the
		fallback, not an addition. Measured on the authors, because the stamp grants
		nobody else.
		"""
		arrived_instructor = self._create_user(
			f"als-legacy-instr-{self.suffix}@example.com", "Lee", "Legacy", ["Course Creator"]
		)
		arrived_course = self._create_course(
			title=f"Legacy Arrived {self.suffix}", instructor=arrived_instructor.name
		)
		chapter = self._create_chapter(f"Legacy Chapter {self.suffix}", arrived_course.name)
		lesson = self._create_lesson(f"Legacy Lesson {self.suffix}", chapter.name, arrived_course.name)
		self._stamp_legacy_quiz_placement(self.quiz.name, self.course.name, lesson.name)

		self.assertEqual(
			frappe.db.get_value("LMS Quiz", self.quiz.name, "course"),
			self.course.name,
			"the stamp no longer names the departed course, so this fixture proves nothing",
		)
		self.assertTrue(lists_for("LMS Quiz", self.quiz.name, arrived_instructor.name))
		self.assertFalse(lists_for("LMS Quiz", self.quiz.name, self.instructor.name))
		self.assertFalse(lists_for("LMS Quiz", self.quiz.name, self.member.name))

	def test_an_unresolvable_legacy_lesson_falls_back_to_the_stamped_course(self):
		"""A lesson removed by a raw path that skipped cleanup leaves .lesson set and
		unresolvable, and dropping the stamp there refuses the course's own people an
		assessment still filed under it."""
		self._stamp_legacy_quiz_placement(self.quiz.name, self.course.name, f"gone-{self.suffix}")
		self.assertTrue(lists_for("LMS Quiz", self.quiz.name, self.instructor.name))
		self.assertFalse(lists_for("LMS Quiz", self.quiz.name, self.member.name))
		self.assertFalse(lists_for("LMS Quiz", self.quiz.name, self.outsider.name))

	def test_the_legacy_assignment_course_lists_for_the_author_only(self):
		"""LMS Assignment has a course and no lesson, so there is nothing to resolve
		through and the stamp is read exactly as it stands — against the authored course
		list."""
		frappe.db.set_value("LMS Assignment", self.assignment.name, "course", self.course.name)
		self.assertTrue(lists_for("LMS Assignment", self.assignment.name, self.instructor.name))
		self.assertFalse(lists_for("LMS Assignment", self.assignment.name, self.member.name))
		self.assertFalse(lists_for("LMS Assignment", self.assignment.name, self.outsider.name))

	# --- the two layers against each other ---

	def test_the_two_layers_answer_the_same_for_every_actor(self):
		"""The acceptance criterion for this commit. A registered pair that disagrees is
		finding F-8's shape, and there the list layer was the half that was right."""
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		self._place_in_lesson(self.course.name, "LMS Assignment", self.assignment.name)
		self._place_in_lesson(self.course.name, "LMS Programming Exercise", self.exercise.name)
		hidden = self._create_quiz(self.questions, title=f"List Hidden {self.suffix}")
		self._place_in_lesson(self.course.name, "LMS Quiz", hidden.name, instructor_only=True)
		assessments = (
			("LMS Quiz", self.quiz.name),
			("LMS Quiz", hidden.name),
			("LMS Assignment", self.assignment.name),
			("LMS Programming Exercise", self.exercise.name),
		)
		actors = (
			self.member.name,
			self.outsider.name,
			self.instructor.name,
			self.author.name,
			"Administrator",
		)
		for doctype, name in assessments:
			for actor in actors:
				self.assertEqual(
					can_access_assessment(doctype, name, user=actor),
					lists_for(doctype, name, actor),
					f"{actor} gets different answers from the two layers for {doctype} {name}",
				)

	def test_the_sequential_lock_is_the_one_thing_the_list_layer_cannot_say(self):
		"""The single divergence, pinned here so it cannot go quiet.

		get_locked_lessons walks the ordered lesson list against the completion set,
		which is not a WHERE fragment. So an enrolled student sees a locked lesson's
		quiz in a list and is refused when they open it. Course Lesson's own query
		condition splits the same way for the same reason: a query condition is the
		list gate and has_permission is the document gate.
		"""
		locked_lesson = self._lock_the_quiz_behind_an_earlier_lesson()
		frappe.set_user(self.member.name)
		try:
			self.assertIn(
				locked_lesson,
				get_locked_lessons(self.course.name),
				"the lesson is not locked, so this measures nothing",
			)
		finally:
			frappe.set_user("Administrator")
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.member.name))
		self.assertTrue(lists_for("LMS Quiz", self.quiz.name, self.member.name))

	def _lock_the_quiz_behind_an_earlier_lesson(self) -> str:
		"""Put the quiz in the second lesson of a course that enforces completion.

		The lock rule reads the ordered lesson list, which comes from the reference
		tables rather than from Course Lesson.chapter, so both chapters need a Chapter
		Reference row for the order to exist at all.
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
