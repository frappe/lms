# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe
from frappe.query_builder import Bracket
from pypika.terms import LiteralValue

from lms.lms.permissions import (
	NO_ASSESSMENT_NAMES,
	_assessment_query_conditions,
	administrable_assessment_names,
	can_access_assessment,
	can_access_quiz,
	can_administer_assessment,
	get_locked_lessons,
)
from lms.lms.test_helpers import BaseTestUtils


def lists_for(doctype: str, name: str, user: str) -> bool:
	"""Whether `user` finds `name` in the doctype's list, through the real hooks.py
	registration. frappe.get_list, never frappe.get_all, which bypasses permissions
	and limit_page_length=0 since the shared site's default page could drop the row."""
	original_user = frappe.session.user
	frappe.set_user(user)
	try:
		return name in frappe.get_list(doctype, pluck="name", limit_page_length=0)
	finally:
		frappe.set_user(original_user)


class TestAssessmentPlacementAccess(BaseTestUtils):
	"""Who reaches an assessment through the lesson that places it. Replaces a
	single-Link stamp that held one course and leaked instructor-only quizzes."""

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
		self.site_admin = self._create_user(
			f"aps-sysman-{suffix}@example.com", "Sam", "SysManager", ["System Manager"]
		)

		self.course = self._create_course(title=f"Placement Course {suffix}", instructor=self.instructor.name)
		self.questions = self._create_quiz_questions()
		self.quiz = self._create_quiz(self.questions, title=f"Placement Quiz {suffix}")
		self.assignment = self._create_assignment(title=f"Placement Assignment {suffix}")
		self.exercise = self._create_programming_exercise(title=f"Placement Exercise {suffix}")
		frappe.db.set_value("LMS Quiz", self.quiz.name, "owner", self.author.name)
		self._set_authors("LMS Quiz", self.quiz.name, [self.author.name])
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

	def test_a_handed_over_assessment_denies_its_original_owner(self):
		"""`authors` is the record of who administers a row today; `owner` is only the
		insert stamp. The owner fallback applies only when `authors` is empty, so once
		the row is handed to somebody else the previous author loses it with it."""
		successor = self._create_user(
			f"aps-successor-{frappe.generate_hash(length=6)}@example.com",
			"Sue",
			"Successor",
			["Course Creator"],
		)
		self._set_authors("LMS Quiz", self.quiz.name, [successor.name])
		self.assertEqual(
			frappe.db.get_value("LMS Quiz", self.quiz.name, "owner"),
			self.author.name,
			"the owner stamp changed, so this fixture no longer measures a handover",
		)
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.author.name))
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=successor.name))

	def test_an_unplaced_co_author_reaches_the_assessment(self):
		"""A second name in `authors` is not a placement; it grants exactly the way a
		sole author does."""
		co_author = self._create_user(
			f"aps-coauthor-{frappe.generate_hash(length=6)}@example.com",
			"Cody",
			"CoAuthor",
			["Course Creator"],
		)
		self._set_authors("LMS Quiz", self.quiz.name, [self.author.name, co_author.name])
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=co_author.name))
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.outsider.name))

	def test_a_system_manager_reaches_every_assessment(self):
		"""The DocPerm every one of these doctypes grants System Manager; the predicate
		must go through is_site_administrator or this role is silently narrowed too."""
		self.assertNotIn("Moderator", frappe.get_roles(self.site_admin.name))
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=self.site_admin.name))

	def test_a_name_that_is_not_a_string_is_refused(self):
		self.assertFalse(can_access_assessment("LMS Quiz", None, user=self.member.name))
		self.assertFalse(can_access_assessment("LMS Quiz", {"title": ("like", "%")}, user=self.member.name))

	def test_a_doctype_that_is_not_an_assessment_is_refused(self):
		self.assertFalse(can_access_assessment("LMS Course", self.course.name, user="Administrator"))

	# --- the regression this commit closes ---

	def test_a_saved_lesson_places_its_quiz_for_the_course_it_is_in(self):
		"""A lesson save writes placement rows and still writes the legacy stamp beside
		them, deliberately, so a later change cannot retire the stamp unnoticed."""
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		self.assertEqual(frappe.db.get_value("LMS Quiz", self.quiz.name, "course"), self.course.name)
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=self.instructor.name))
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=self.member.name))
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.outsider.name))

	def test_the_quiz_endpoints_read_every_placement_the_table_holds(self):
		"""`LMS Quiz.course` holds one value for a quiz that can sit in many courses,
		with the last lesson saved winning. can_access_quiz now delegates to
		can_access_assessment, which reads the placement table instead."""
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
		self.assertTrue(can_access_quiz(self.quiz.name, user=self.instructor.name))

	def test_the_quiz_endpoints_refuse_an_instructor_only_quiz(self):
		"""`validate_quiz_id` stamps `LMS Quiz.course` from `instructor_content` too, so
		every enrolled member used to reach a quiz embedded only in instructor notes.
		can_access_assessment reads that stamp as author-only; the endpoints now agree."""
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name, instructor_only=True)
		self.assertEqual(
			frappe.db.get_value("LMS Quiz", self.quiz.name, "course"),
			self.course.name,
			"the instructor-only save did not stamp the quiz, so this measures nothing",
		)
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.member.name))
		self.assertFalse(can_access_quiz(self.quiz.name, user=self.member.name))

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
		"""The rule the placement table exists for: the lesson save stamps this quiz from
		`instructor_content` exactly as it would from `content`, so a student placement
		reading of the stamp would grant the member here and the flag would be inert."""
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
		"""Course Lesson.course is a copy-on-save fetch_from mirror, so a chapter
		re-pointed at another course leaves every lesson under it naming the departed
		course, and reading placements off that mirror would grant the wrong author."""
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
		"""Lessons saved before the placement table have only the frozen stamp; without
		this fallback the gate denies every already-embedded assessment's author. It
		grants the author only, since the stamp cannot say content vs. instructor notes."""
		self._stamp_legacy_quiz_placement(self.quiz.name, self.course.name)
		self.assertFalse(
			frappe.db.exists("LMS Lesson Assessment", {"assessment_name": self.quiz.name}),
			"a placement row exists, so this is not measuring the legacy path",
		)
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=self.instructor.name))
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.member.name))
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user=self.outsider.name))

	def test_the_legacy_assignment_course_field_grants_the_author_and_not_its_members(self):
		"""LMS Assignment.course is author-picked, so it carries no instructor-notes
		hazard of its own, but is read the same way anyway: one reading of "the stamp"
		is cheaper to hold than two."""
		frappe.db.set_value("LMS Assignment", self.assignment.name, "course", self.course.name)
		self.assertTrue(
			can_access_assessment("LMS Assignment", self.assignment.name, user=self.instructor.name)
		)
		self.assertFalse(can_access_assessment("LMS Assignment", self.assignment.name, user=self.member.name))
		self.assertFalse(
			can_access_assessment("LMS Assignment", self.assignment.name, user=self.outsider.name)
		)


class TestAssessmentBatchAccess(BaseTestUtils):
	"""The batch branch: an evaluator of a batch may read the answer keys of the
	assessments that batch runs. Pinned here because the branch used to hard-code
	assessment_type="LMS Quiz", so carrying the doctype under test matters."""

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
	"""The list half of the same rule: a has_permission hook is never consulted on a
	list query, so a doctype registered for one and not the other still enumerates
	every row through /api/resource, reports, exports and Data Import."""

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
		self._set_authors("LMS Quiz", self.quiz.name, [self.author.name])
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
		"""The outsider holds LMS Student, which grants read site-wide; only the
		registered query condition refuses them, and only get_list applies it.
		get_all sets ignore_permissions=True and hands back the same row."""
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		frappe.set_user(self.outsider.name)
		try:
			self.assertNotIn(self.quiz.name, frappe.get_list("LMS Quiz", pluck="name", limit_page_length=0))
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

	def test_a_system_manager_is_unrestricted(self):
		"""System Manager holds a DocPerm on every assessment doctype; the query
		condition must widen for it the same way it does for Administrator."""
		site_admin = self._create_user(
			f"als-sysman-{self.suffix}@example.com", "Sam", "SysManager", ["System Manager"]
		)
		self.assertNotIn("Moderator", frappe.get_roles(site_admin.name))
		self.assertEqual(_assessment_query_conditions("LMS Quiz", site_admin.name), "")
		self.assertTrue(lists_for("LMS Quiz", self.quiz.name, site_admin.name))

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
		"""Course Lesson.course is a copy-on-save fetch_from mirror a chapter's move
		leaves naming the departed course, so a join through it would list the
		assessment for the wrong course."""
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
		"""Folding the stamped course in unconditionally would hand the departed course's
		instructors an answer key the lesson took with it: the stamped course is the
		fallback, not an addition."""
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
		"""The acceptance criterion for this commit: a registered pair that disagrees
		here has burned an earlier reviewer before, and the list layer was the half
		that was right."""
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
		"""The single divergence, pinned here: get_locked_lessons walks the ordered
		lesson list against the completion set, which is not a WHERE fragment, so a
		locked assessment is listed and refused only when opened."""
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
		"""Put the quiz in the second lesson of a course that enforces completion. The
		lock rule reads the ordered lesson list from the reference tables, so both
		chapters need a Chapter Reference row for the order to exist at all."""
		first_chapter = self._create_chapter(f"Lock Chapter {self.suffix}", self.course.name)
		first_lesson = self._create_lesson(f"Lock Lesson {self.suffix}", first_chapter.name, self.course.name)
		self._create_chapter_reference(self.course.name, first_chapter.name, idx=1)
		self._create_lesson_reference(first_chapter.name, first_lesson.name)
		placed = self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		self._create_chapter_reference(self.course.name, placed.chapter, idx=2)
		self._create_lesson_reference(placed.chapter, placed.name)
		frappe.db.set_value("LMS Course", self.course.name, "enforce_lesson_completion", 1)
		return placed.name


def names_matching_subquery(doctype: str, subquery: str, name: str) -> list[str]:
	"""`name`, if the raw subquery selects it, nested the way a future submission query
	condition will nest it: `name in (<subquery>)`.

	administrable_assessment_names hands out SQL text because a query condition is SQL
	text, so the nesting has to happen here. Bracket(LiteralValue(...)) is how pypika
	nests a string that is already SQL -- the rest of the statement is built, not
	formatted, and `name` is bound by the query builder."""
	assessment = frappe.qb.DocType(doctype)
	return (
		frappe.qb.from_(assessment)
		.select(assessment.name)
		.where(assessment.name.isin(Bracket(LiteralValue(subquery))))
		.where(assessment.name == name)
		.run(pluck=True)
	)


def administers_in_sql(doctype: str, name: str, user: str) -> bool:
	"""Whether the administer subquery names `name`, nested the way a future submission
	query condition will nest it. administrable_assessment_names returns a bare
	subquery, not a query condition, so there is no get_list to route it through."""
	subquery = administrable_assessment_names(doctype, user)
	return bool(names_matching_subquery(doctype, subquery, name))


class TestAssessmentAdministerScope(BaseTestUtils):
	"""The instructor-only reading a future submission gate will depend on: reachable
	by course authors, batch instructors and tagged evaluators, and by no enrolled
	member, since every learner is an enrolled member of their own course."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.suffix = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"aad-instr-{self.suffix}@example.com", "Ivy", "Instructor", ["Course Creator"]
		)
		self.author = self._create_user(
			f"aad-author-{self.suffix}@example.com", "Amy", "Author", ["Course Creator"]
		)
		self.member = self._create_user(
			f"aad-member-{self.suffix}@example.com", "Mel", "Member", ["LMS Student"]
		)
		self.outsider = self._create_user(
			f"aad-outsider-{self.suffix}@example.com", "Ove", "Outsider", ["LMS Student"]
		)
		self.moderator = self._create_user(
			f"aad-mod-{self.suffix}@example.com", "Moe", "Moderator", ["Moderator"]
		)
		self.course = self._create_course(
			title=f"Administer Course {self.suffix}", instructor=self.instructor.name
		)
		self.questions = self._create_quiz_questions()
		self.quiz = self._create_quiz(self.questions, title=f"Administer Quiz {self.suffix}")
		self.assignment = self._create_assignment(title=f"Administer Assignment {self.suffix}")
		frappe.db.set_value("LMS Quiz", self.quiz.name, "owner", self.author.name)
		self._set_authors("LMS Quiz", self.quiz.name, [self.author.name])
		self._create_enrollment(self.member.name, self.course.name)
		self._place_in_lesson(self.course.name, "LMS Quiz", self.quiz.name)
		self._place_in_lesson(self.course.name, "LMS Assignment", self.assignment.name)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	# --- the controls, read before any count ---

	def test_the_actors_hold_the_roles_the_refusals_rest_on(self):
		"""A Moderator is granted by a branch this suite is not about, and the member
		must really be enrolled or its refusal would prove nothing."""
		for user in (self.member, self.outsider, self.instructor, self.author):
			self.assertNotIn("Moderator", frappe.get_roles(user.name), user.name)
		self.assertIn("Moderator", frappe.get_roles(self.moderator.name))
		self.assertTrue(
			frappe.db.exists("LMS Enrollment", {"course": self.course.name, "member": self.member.name})
		)

	def test_the_access_predicate_grants_the_member_this_suite_refuses(self):
		"""The control the split is measured against. Without this the refusals below
		could be a broken placement rather than the narrower reading."""
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=self.member.name))
		self.assertTrue(lists_for("LMS Quiz", self.quiz.name, self.member.name))

	# --- the split, on both layers ---

	def test_an_enrolled_member_may_not_administer_what_they_may_access(self):
		"""The reason this predicate exists. Both layers, because a submission pair
		composed on the list half alone would leak on /api/resource and nowhere else."""
		self.assertFalse(can_administer_assessment("LMS Quiz", self.quiz.name, user=self.member.name))
		self.assertFalse(administers_in_sql("LMS Quiz", self.quiz.name, self.member.name))

	def test_a_batch_member_may_not_administer_the_batch_assessment(self):
		"""The other member branch. A batch enrolment reaches the assessment and
		administers nothing."""
		evaluator = self._create_user(
			f"aad-beval-{self.suffix}@example.com", "Ela", "Evaluator", ["Batch Evaluator"]
		)
		self._create_evaluator(evaluator.name)
		batch_instructor = self._create_user(
			f"aad-bmi-{self.suffix}@example.com", "Bud", "Instructor", ["Course Creator", "Batch Evaluator"]
		)
		batch = self._create_batch(
			self.course.name,
			instructor=batch_instructor.name,
			title=f"Administer Batch {self.suffix}",
			evaluator=evaluator.name,
		)
		batch.append("assessment", {"assessment_type": "LMS Quiz", "assessment_name": self.quiz.name})
		batch.save()
		student = self._create_user(f"aad-batch-{self.suffix}@example.com", "Bea", "Batch", ["LMS Student"])
		self._create_batch_enrollment(student.name, batch.name)
		self.assertTrue(can_access_assessment("LMS Quiz", self.quiz.name, user=student.name))
		self.assertFalse(can_administer_assessment("LMS Quiz", self.quiz.name, user=student.name))
		self.assertFalse(administers_in_sql("LMS Quiz", self.quiz.name, student.name))

	def test_the_course_instructor_administers_it_on_both_layers(self):
		self.assertTrue(can_administer_assessment("LMS Quiz", self.quiz.name, user=self.instructor.name))
		self.assertTrue(administers_in_sql("LMS Quiz", self.quiz.name, self.instructor.name))

	def test_the_author_administers_their_own_assessment(self):
		self.assertTrue(can_administer_assessment("LMS Quiz", self.quiz.name, user=self.author.name))
		self.assertTrue(administers_in_sql("LMS Quiz", self.quiz.name, self.author.name))

	def test_an_outsider_administers_nothing(self):
		self.assertFalse(can_administer_assessment("LMS Quiz", self.quiz.name, user=self.outsider.name))
		self.assertFalse(administers_in_sql("LMS Quiz", self.quiz.name, self.outsider.name))

	def test_a_batch_instructor_and_its_tagged_evaluator_administer_it(self):
		"""can_modify_batch answers the instructor list; the evaluator tag is a separate
		probe because develop's can_modify_batch has no evaluator branch."""
		evaluator = self._create_user(
			f"aad-eval-{self.suffix}@example.com", "Eve", "Evaluator", ["Batch Evaluator"]
		)
		self._create_evaluator(evaluator.name)
		batch_instructor = self._create_user(
			f"aad-binstr-{self.suffix}@example.com",
			"Bob",
			"Instructor",
			["Course Creator", "Batch Evaluator"],
		)
		batch = self._create_batch(
			self.course.name,
			instructor=batch_instructor.name,
			title=f"Administer Assessed {self.suffix}",
			evaluator=evaluator.name,
		)
		batch.append("assessment", {"assessment_type": "LMS Quiz", "assessment_name": self.quiz.name})
		batch.save()
		for user in (batch_instructor.name, evaluator.name):
			with self.subTest(user=user):
				self.assertTrue(can_administer_assessment("LMS Quiz", self.quiz.name, user=user))
				self.assertTrue(administers_in_sql("LMS Quiz", self.quiz.name, user))

	# --- the four callers ---

	def test_guest_administers_nothing_and_lists_nothing(self):
		"""Guest is a real user in frappe, so it is passed as the literal string."""
		self.assertFalse(can_administer_assessment("LMS Quiz", self.quiz.name, user="Guest"))
		self.assertFalse(administers_in_sql("LMS Quiz", self.quiz.name, "Guest"))
		self.assertFalse(can_access_assessment("LMS Quiz", self.quiz.name, user="Guest"))

	def test_a_doctype_that_is_not_an_assessment_is_refused_by_both_halves(self):
		"""The empty-set subquery, not an empty string: "" is a syntax error inside
		`in (...)` where it would mean "no restriction" at the top of a condition."""
		self.assertFalse(can_administer_assessment("LMS Course", self.course.name, user="Administrator"))
		self.assertEqual(administrable_assessment_names("LMS Course", "Administrator"), NO_ASSESSMENT_NAMES)
		self.assertEqual(names_matching_subquery("LMS Quiz", NO_ASSESSMENT_NAMES, self.quiz.name), [])

	def test_a_name_that_is_not_a_string_is_refused(self):
		"""get_value's second argument is `filters`, so a mapping would be matched
		against the whole table and resolve an arbitrary row."""
		self.assertFalse(can_administer_assessment("LMS Quiz", None, user=self.instructor.name))
		self.assertFalse(
			can_administer_assessment("LMS Quiz", {"title": ("like", "%")}, user=self.instructor.name)
		)

	def test_an_unrestricted_caller_gets_every_name_rather_than_an_empty_string(self):
		for user in (self.moderator.name, "Administrator"):
			with self.subTest(user=user):
				self.assertEqual(
					administrable_assessment_names("LMS Quiz", user), "SELECT `name` FROM `tabLMS Quiz`"
				)
				self.assertTrue(administers_in_sql("LMS Quiz", self.quiz.name, user))
				self.assertTrue(can_administer_assessment("LMS Quiz", self.quiz.name, user=user))

	def test_a_system_manager_administers_every_assessment(self):
		"""System Manager holds a DocPerm on every assessment doctype; the administer
		predicate must widen for it the same way it does for Moderator."""
		site_admin = self._create_user(
			f"aad-sysman-{self.suffix}@example.com", "Sam", "SysManager", ["System Manager"]
		)
		self.assertNotIn("Moderator", frappe.get_roles(site_admin.name))
		self.assertTrue(can_administer_assessment("LMS Quiz", self.quiz.name, user=site_admin.name))
		self.assertTrue(administers_in_sql("LMS Quiz", self.quiz.name, site_admin.name))

	# --- instructor_only is no exception on this path ---

	def test_an_instructor_only_placement_is_no_exception_to_the_administer_reading(self):
		"""A student-visible placement and an instructor-only one answer identically
		here, unlike for can_access_assessment, since authorship is the only course
		branch left once the member branches are gone."""
		hidden = self._create_quiz(self.questions, title=f"Administer Hidden {self.suffix}")
		frappe.db.set_value("LMS Quiz", hidden.name, "owner", self.author.name)
		self._place_in_lesson(self.course.name, "LMS Quiz", hidden.name, instructor_only=True)
		self.assertTrue(can_administer_assessment("LMS Quiz", hidden.name, user=self.instructor.name))
		self.assertTrue(administers_in_sql("LMS Quiz", hidden.name, self.instructor.name))
		self.assertFalse(can_administer_assessment("LMS Quiz", hidden.name, user=self.member.name))
		self.assertFalse(administers_in_sql("LMS Quiz", hidden.name, self.member.name))
		self.assertFalse(can_access_assessment("LMS Quiz", hidden.name, user=self.member.name))

	# --- the two layers against each other ---

	def test_the_two_administer_layers_answer_the_same_for_every_actor(self):
		"""An agreement sweep for the administer pair: an earlier draft of this predicate
		had a real branch-order bug that only this shape of test caught."""
		hidden = self._create_quiz(self.questions, title=f"Administer Agree {self.suffix}")
		self._place_in_lesson(self.course.name, "LMS Quiz", hidden.name, instructor_only=True)
		assessments = (
			("LMS Quiz", self.quiz.name),
			("LMS Quiz", hidden.name),
			("LMS Assignment", self.assignment.name),
		)
		actors = (
			self.member.name,
			self.outsider.name,
			self.instructor.name,
			self.author.name,
			self.moderator.name,
			"Guest",
			"Administrator",
		)
		for doctype, name in assessments:
			for actor in actors:
				self.assertEqual(
					can_administer_assessment(doctype, name, user=actor),
					administers_in_sql(doctype, name, actor),
					f"{actor} gets different answers from the two administer layers for {doctype} {name}",
				)
