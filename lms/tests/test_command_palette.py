# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from lms.command_palette import (
	CATEGORY_DOCTYPES,
	COURSE_SCOPED_DOCTYPES,
	DOCTYPE_GROUPS,
	PERMISSION_CHECKED_DOCTYPES,
	RESULT_FIELDS,
	get_grouped_results,
	get_permitted_names,
	is_visible,
	prepare_search_results,
	search_sqlite,
)
from lms.lms.test_helpers import BaseTestUtils


def row(doctype, name, **extra):
	"""An index row the way the index writes one: `id` is `<doctype>:<name>`."""
	return {"id": f"{doctype}:{name}", "doctype": doctype, "name": name, **extra}


class TestSearchCategoryValidation(FrappeTestCase):
	"""The category names a doctype for the index's SQL, so it can only ever come
	from CATEGORY_DOCTYPES — a caller's own string must not reach the query."""

	def test_every_category_maps_to_a_grouped_doctype(self):
		for doctype in CATEGORY_DOCTYPES.values():
			self.assertIn(doctype, DOCTYPE_GROUPS)

	def test_unknown_category_is_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			search_sqlite("kubernetes", category="doctype = 'User' --")

	# Frappe coerces annotated arguments before the body runs, so a wrongly typed
	# argument dies as FrappeTypeError and never reaches the isinstance guard.
	# That guard is the backstop for the day the annotation goes away — dropping
	# it would silently hand a list to the search.
	def test_non_string_category_is_rejected(self):
		with self.assertRaises((frappe.exceptions.FrappeTypeError, frappe.ValidationError)):
			search_sqlite("kubernetes", category=["courses"])

	def test_non_string_query_is_rejected(self):
		with self.assertRaises((frappe.exceptions.FrappeTypeError, frappe.ValidationError)):
			search_sqlite(["kubernetes"])


class TestIndexSchema(FrappeTestCase):
	"""SQLiteSearch validates its schema when the class is instantiated, so a
	doctype missing a content field fails here rather than at the next reindex."""

	def test_every_searchable_category_is_indexed(self):
		from lms.sqlite import LearningSearch

		configs = LearningSearch().doc_configs
		for doctype in CATEGORY_DOCTYPES.values():
			with self.subTest(doctype=doctype):
				self.assertIn(doctype, configs)


class TestTitleOnlySearch(FrappeTestCase):
	def test_the_search_is_restricted_to_titles(self):
		from unittest.mock import patch

		with patch("lms.sqlite.LearningSearch.search") as search:
			search.return_value = {"results": []}
			search_sqlite("cour")

		self.assertTrue(search.call_args.kwargs["title_only"])


class TestResultVisibility(FrappeTestCase):
	def test_unmapped_doctype_is_dropped(self):
		groups = get_grouped_results({"results": [row("User", "someone@example.com")]})
		self.assertEqual(groups, {})

	def test_a_published_course_is_visible_to_a_student(self):
		course = row("LMS Course", "published-course", published=1)
		self.assertTrue(is_visible(course, "LMS Course", ["LMS Student"], {}))

	def test_an_unpublished_course_is_hidden_from_a_student(self):
		course = row("LMS Course", "draft-course", published=0)
		self.assertFalse(is_visible(course, "LMS Course", ["LMS Student"], {}))

	def test_a_closed_job_is_hidden_from_a_student(self):
		job = row("Job Opportunity", "JOB-0001", status="Closed")
		self.assertFalse(is_visible(job, "Job Opportunity", ["LMS Student"], {}))

	# The doctypes added for the palette are gated by frappe.get_list, so what
	# reaches `permitted` is the whole of their visibility rule.
	def test_a_permission_checked_row_needs_its_name_permitted(self):
		quiz = row("LMS Quiz", "quiz-1")
		self.assertFalse(is_visible(quiz, "LMS Quiz", ["LMS Student"], {}))
		self.assertTrue(is_visible(quiz, "LMS Quiz", ["LMS Student"], {"LMS Quiz": {"quiz-1"}}))

	def test_permitted_names_are_not_collected_for_hand_checked_doctypes(self):
		permitted = get_permitted_names([row("LMS Course", "a-course")])
		self.assertNotIn("LMS Course", permitted)

	def test_a_user_without_read_access_gets_an_empty_set_rather_than_an_error(self):
		for doctype in PERMISSION_CHECKED_DOCTYPES:
			with self.subTest(doctype=doctype):
				frappe.set_user("Guest")
				try:
					permitted = get_permitted_names([row(doctype, "does-not-matter")])
				finally:
					frappe.set_user("Administrator")
				self.assertEqual(permitted.get(doctype), set())


class TestQuizAndAssignmentScope(BaseTestUtils):
	"""LMS Quiz and LMS Assignment grant read to LMS Student and register no
	permission_query_conditions hook, so get_list alone handed a student every
	row on the site."""

	def setUp(self):
		super().setUp()
		self.student = self._create_user("palette-student@example.com", "Pal", "Ette", ["LMS Student"])
		self.questions = self._create_quiz_questions()
		self.quiz = self._create_quiz(title="Palette Scope Quiz")
		self.assignment = self._create_assignment(title="Palette Scope Assignment")

	def test_a_student_is_given_no_quiz_or_assignment(self):
		frappe.set_user(self.student.email)
		try:
			for doctype, name in (
				("LMS Quiz", self.quiz.name),
				("LMS Assignment", self.assignment.name),
			):
				with self.subTest(doctype=doctype):
					permitted = get_permitted_names([row(doctype, name)])
					self.assertEqual(permitted[doctype], set())
		finally:
			frappe.set_user("Administrator")

	def test_a_student_can_read_these_doctypes_directly(self):
		"""Pins why the hand-written scope is needed: frappe itself allows it."""
		frappe.set_user(self.student.email)
		try:
			readable = frappe.get_list("LMS Quiz", pluck="name", limit_page_length=0)
		finally:
			frappe.set_user("Administrator")
		self.assertIn(self.quiz.name, readable)

	def test_a_moderator_is_given_them(self):
		permitted = get_permitted_names([row("LMS Quiz", self.quiz.name)])
		self.assertEqual(permitted["LMS Quiz"], {self.quiz.name})

	def test_every_course_scoped_doctype_is_permission_checked(self):
		for doctype in COURSE_SCOPED_DOCTYPES:
			self.assertIn(doctype, PERMISSION_CHECKED_DOCTYPES)


class TestGroupOrder(FrappeTestCase):
	def test_groups_come_back_in_the_documented_order(self):
		result = {
			"results": [
				row("LMS Batch", "b1", published=1, start_date="2999-01-01", modified=2),
				row("LMS Course", "c1", published=1, modified=1),
			]
		}
		titles = [group["title"] for group in prepare_search_results(result)]
		self.assertEqual(titles, ["Courses", "Batches"])


class TestProgramScope(BaseTestUtils):
	"""LMS Program is registered in permission_query_conditions (hooks.py), unlike
	LMS Quiz and LMS Assignment, so get_list is expected to constrain it. This
	pins that, because the palette relies on it rather than scoping by hand."""

	def setUp(self):
		super().setUp()
		self.student = self._create_user("prog-student@example.com", "Prog", "Student", ["LMS Student"])
		self.hidden = frappe.new_doc("LMS Program")
		self.hidden.update({"title": "Palette Unpublished Program", "published": 0})
		self.hidden.save()
		self.cleanup_items.append(("LMS Program", self.hidden.name))

	def test_a_student_is_not_given_an_unpublished_program(self):
		frappe.set_user(self.student.email)
		try:
			permitted = get_permitted_names([row("LMS Program", self.hidden.name)])
		finally:
			frappe.set_user("Administrator")
		self.assertEqual(permitted["LMS Program"], set())


class TestStaleIndexRows(FrappeTestCase):
	"""Course Instructor rows were indexed and then rewritten to look like their
	parent course, which left `id` naming the child row while `doctype` and
	`name` named the course. They stopped being indexed, but every learning.db
	built before that still holds them at the `published` value they were
	written with, and `remove_doc` deletes by `LMS Course:<name>`, so nothing
	reaches them until the index is rebuilt."""

	def stale_twin(self, doctype, name, **extra):
		twin = row(doctype, name, **extra)
		twin["id"] = "Course Instructor:5f4dcc3b5a"
		return twin

	def test_a_row_standing_for_another_document_is_dropped(self):
		twin = self.stale_twin("LMS Course", "draft-course", published=1)
		self.assertEqual(get_grouped_results({"results": [twin]}), {})

	def test_the_matching_row_is_kept(self):
		course = row("LMS Course", "draft-course", published=1)
		self.assertEqual(list(get_grouped_results({"results": [course]})), ["Courses"])

	# The twin is what carried the stale `published`, and the visibility check
	# runs before `remove_duplicates` — so deduplicating never reached it.
	def test_a_stale_twin_cannot_publish_the_course_it_names(self):
		result = {
			"results": [
				row("LMS Course", "draft-course", published=0, modified=1),
				self.stale_twin("LMS Course", "draft-course", published=1, modified=1),
			]
		}
		frappe.set_user("Guest")
		try:
			groups = prepare_search_results(result)
		finally:
			frappe.set_user("Administrator")
		self.assertEqual(groups, [])


class TestResultProjection(FrappeTestCase):
	"""`title_only` makes frappe select the raw `content` column rather than a
	snippet of it, so an unprojected row carries a whole course description."""

	def test_a_row_carries_only_what_the_palette_draws(self):
		result = {
			"results": [
				row(
					"LMS Course",
					"c1",
					published=1,
					modified=1,
					content="the entire course description, every word of it",
					author="someone@example.com",
					score=2.5,
				)
			]
		}
		item = prepare_search_results(result)[0]["items"][0]
		self.assertEqual(set(item), set(RESULT_FIELDS))

	def test_the_indexed_content_never_leaves_the_server(self):
		result = {"results": [row("LMS Course", "c1", published=1, modified=1, content="prose")]}
		item = prepare_search_results(result)[0]["items"][0]
		self.assertNotIn("content", item)


class TestAuthoredScope(BaseTestUtils):
	"""`course` is optional on LMS Quiz and LMS Assignment and the quiz form never
	asks for it, so scoping by course alone lost an author the quiz they had just
	made — and a Batch Evaluator, who instructs no courses, had no way in at all."""

	def setUp(self):
		super().setUp()
		self.author = self._create_user("palette-author@example.com", "Pal", "Author", ["Course Creator"])
		self.evaluator = self._create_user(
			"palette-evaluator@example.com", "Pal", "Eval", ["Batch Evaluator"]
		)
		self.questions = self._create_quiz_questions()
		self.quiz = self._create_quiz(title="Palette Authored Quiz")
		frappe.db.set_value("LMS Quiz", self.quiz.name, "owner", self.author.name)

	def permitted_for(self, user):
		frappe.set_user(user)
		try:
			return get_permitted_names([row("LMS Quiz", self.quiz.name)])["LMS Quiz"]
		finally:
			frappe.set_user("Administrator")

	def test_the_quiz_has_no_course_to_be_scoped_by(self):
		self.assertFalse(frappe.db.get_value("LMS Quiz", self.quiz.name, "course"))

	def test_an_author_is_given_the_quiz_they_made(self):
		self.assertEqual(self.permitted_for(self.author.name), {self.quiz.name})

	def test_an_evaluator_is_given_the_quiz_they_made(self):
		frappe.db.set_value("LMS Quiz", self.quiz.name, "owner", self.evaluator.name)
		self.assertEqual(self.permitted_for(self.evaluator.name), {self.quiz.name})

	def test_another_author_is_not_given_it(self):
		self.assertEqual(self.permitted_for(self.evaluator.name), set())
