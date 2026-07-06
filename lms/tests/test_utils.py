# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

from datetime import datetime

import frappe
from frappe.utils import getdate, to_timedelta

from lms.lms.doctype.lms_certificate.lms_certificate import is_certified
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import (
	create_user,
	get_average_rating,
	get_batch_details,
	get_chapters,
	get_course_categories,
	get_course_details,
	get_evaluator,
	get_instructors,
	get_lesson_index,
	get_lesson_url,
	get_lessons,
	get_lms_route,
	get_membership,
	get_reviews,
	has_course_instructor_role,
	has_evaluator_role,
	has_moderator_role,
	has_student_role,
	is_instructor,
	slugify,
)


class TestLMSUtils(BaseTestUtils):
	def setUp(self):
		super().setUp()

		self._setup_course_flow()
		self._setup_batch_flow()

	def test_simple_slugs(self):
		self.assertEqual(slugify("hello-world"), "hello-world")
		self.assertEqual(slugify("Hello World"), "hello-world")
		self.assertEqual(slugify("Hello, World!"), "hello-world")

	def test_duplicates_slugs(self):
		self.assertEqual(slugify("Hello World", ["hello-world"]), "hello-world-2")
		self.assertEqual(slugify("Hello World", ["hello-world", "hello-world-2"]), "hello-world-3")

	def test_get_membership(self):
		membership = get_membership(self.course.name, self.student1.email)
		self.assertIsNotNone(membership)
		self.assertEqual(membership.course, self.course.name)
		self.assertEqual(membership.member, self.student1.email)

	def test_get_chapters(self):
		chapters = get_chapters(self.course.name)
		self.assertEqual(len(chapters), len(self.course.chapters))

		for i, chapter in enumerate(chapters, start=1):
			self.assertEqual(chapter.title, f"Chapter {i}")

	def test_get_lessons(self):
		lessons = get_lessons(self.course.name)
		all_lessons = frappe.db.count("Course Lesson", {"course": self.course.name})
		self.assertEqual(len(lessons), all_lessons)

	def test_get_instructors(self):
		instructors = get_instructors("LMS Course", self.course.name)
		self.assertEqual(len(instructors), len(self.course.instructors))
		self.assertEqual(instructors[0].name, "frappe@example.com")

	def test_get_average_rating(self):
		average_rating = get_average_rating(self.course.name)
		self.assertEqual(average_rating, 4.5)

	def test_get_reviews(self):
		reviews = get_reviews(self.course.name)
		self.assertEqual(len(reviews), 2)

	def test_get_reviews_creation_is_datetime(self):
		# Regression guard: get_reviews must return the raw `creation` datetime,
		# not a pretty_date() string. The frontend computes the relative age from
		# this value, so a prettified string made every review render as "Today".
		reviews = get_reviews(self.course.name)
		for review in reviews:
			self.assertIsInstance(review.creation, datetime)

	def test_get_reviews_scales_rating_to_display_range(self):
		# stored 0–1 fractions are returned on the 0–5 display scale (× out_of_ratings)
		ratings_by_owner = {review.owner: review.rating for review in get_reviews(self.course.name)}
		self.assertEqual(ratings_by_owner[self.student1.email], 4.0)  # stored 0.8
		self.assertEqual(ratings_by_owner[self.student2.email], 5.0)  # stored 1.0

	def test_get_reviews_includes_owner_details(self):
		review = next(r for r in get_reviews(self.course.name) if r.owner == self.student1.email)
		self.assertIsNotNone(review.owner_details)
		self.assertEqual(review.owner_details.full_name, self.student1.full_name)

	def test_get_reviews_ordered_newest_first(self):
		# student2's review is added after student1's; order_by creation desc
		reviews = get_reviews(self.course.name)
		self.assertEqual(reviews[0].owner, self.student2.email)
		self.assertEqual(reviews[1].owner, self.student1.email)

	def test_get_average_rating_none_without_reviews(self):
		course = frappe.new_doc("LMS Course")
		course.update(
			{
				"title": "Unrated Course",
				"short_introduction": "No reviews yet",
				"description": "A course with no reviews.",
				"category": self.course.category,
				"published": 1,
				"instructors": [{"instructor": "frappe@example.com"}],
			}
		)
		course.save()
		self.cleanup_items.append(("LMS Course", course.name))
		self.assertIsNone(get_average_rating(course.name))

	def test_get_lesson_index(self):
		lessons = get_lessons(self.course.name)
		for lesson in lessons:
			self.assertEqual(get_lesson_index(lesson.name), lesson.number)

	def test_get_lesson_url(self):
		lessons = get_lessons(self.course.name)
		for lesson in lessons:
			expected_url = get_lms_route(f"courses/{self.course.name}/learn/{lesson.number}")
			self.assertEqual(get_lesson_url(self.course.name, lesson.number), expected_url)

	def test_is_instructor(self):
		frappe.session.user = "frappe@example.com"
		self.assertTrue(is_instructor(self.course.name))
		frappe.session.user = "Administrator"
		self.assertFalse(is_instructor(self.course.name))

	def test_has_course_instructor_role(self):
		self.assertIsNotNone(has_course_instructor_role("frappe@example.com"))
		self.assertIsNone(has_course_instructor_role("student1@example.com"))

	def test_has_moderator_role(self):
		self.assertIsNotNone(has_moderator_role("frappe@example.com"))
		self.assertIsNone(has_moderator_role("student2@example.com"))

	def test_has_evaluator_role(self):
		self.assertIsNotNone(has_evaluator_role("frappe@example.com"))
		self.assertIsNone(has_evaluator_role("student2@example.com"))

	def test_has_student_role(self):
		self.assertIsNotNone(has_student_role("student1@example.com"))
		self.assertIsNotNone(has_student_role("student2@example.com"))

	def test_is_certified(self):
		frappe.session.user = self.student1.email
		self.assertIsNotNone(is_certified(self.course.name))
		frappe.session.user = self.student2.email
		self.assertIsNone(is_certified(self.course.name))
		frappe.session.user = "Administrator"

	def test_rating_validation(self):
		student3 = self._create_user("student3@example.com", "Emily", "Cooper", ["LMS Student"])
		with self.assertRaises(frappe.exceptions.ValidationError):
			frappe.session.user = student3.email
			review = frappe.new_doc("LMS Course Review")
			review.course = self.course.name
			review.rating = -0.5
			review.review = "Bad course"
			review.save()
		frappe.session.user = "Administrator"

	def test_get_evaluator(self):
		evaluator_email = get_evaluator(self.course.name, self.batch.name)
		self.assertEqual(evaluator_email, self.evaluator.evaluator)

	def test_get_course_details(self):
		course_details = get_course_details(self.course.name)
		self.assertEqual(course_details.name, self.course.name)
		self.assertEqual(course_details.title, self.course.title)
		self.assertEqual(course_details.category, self.course.category)
		self.assertEqual(course_details.description, self.course.description)
		self.assertEqual(course_details.short_introduction, self.course.short_introduction)
		self.assertEqual(course_details.tags, self.course.tags)
		self.assertEqual(course_details.published, 1)
		self.assertEqual(len(course_details.instructors), len(self.course.instructors))

	def test_get_batch_details(self):
		batch_details = get_batch_details(self.batch.name)
		self.assertEqual(batch_details.name, self.batch.name)
		self.assertEqual(batch_details.title, self.batch.title)
		self.assertEqual(batch_details.start_date, getdate(self.batch.start_date))
		self.assertEqual(batch_details.end_date, getdate(self.batch.end_date))
		self.assertEqual(batch_details.start_time, to_timedelta(self.batch.start_time))
		self.assertEqual(batch_details.end_time, to_timedelta(self.batch.end_time))
		self.assertEqual(batch_details.timezone, self.batch.timezone)
		self.assertEqual(batch_details.published, 1)
		self.assertEqual(batch_details.description, self.batch.description)
		self.assertEqual(batch_details.batch_details, self.batch.batch_details)
		self.assertEqual(len(batch_details.courses), len(self.batch.courses))
		self.assertEqual(batch_details.evaluation_end_date, getdate(self.batch.evaluation_end_date))
		self.assertEqual(len(batch_details.instructors), len(self.batch.instructors))
		self.assertEqual(len(batch_details.students), 2)

	def test_get_course_categories_includes_used_category(self):
		categories = get_course_categories()
		labels = [category["label"] for category in categories]
		self.assertIn(self.course.category, labels)

	def test_get_course_categories_has_clear_option(self):
		categories = get_course_categories()
		self.assertEqual(categories[0], {"label": "", "value": None})

	def test_get_course_categories_is_independent_of_active_filter(self):
		other = self._create_user("creator2@example.com", "Cat", "Two", ["Course Creator"])
		if not frappe.db.exists("LMS Category", "Marketing"):
			frappe.get_doc({"doctype": "LMS Category", "category": "Marketing"}).insert(
				ignore_permissions=True
			)
			self.cleanup_items.append(("LMS Category", "Marketing"))

		second = frappe.new_doc("LMS Course")
		second.update(
			{
				"title": "Second Utility Course",
				"short_introduction": "Another course",
				"description": "Second course description.",
				"category": "Marketing",
				"published": 1,
				"instructors": [{"instructor": other.email}],
			}
		)
		second.save()
		self.cleanup_items.append(("LMS Course", second.name))

		labels = [category["label"] for category in get_course_categories()]
		self.assertIn("Business", labels)
		self.assertIn("Marketing", labels)

	def test_get_course_categories_excludes_unpublished(self):
		if not frappe.db.exists("LMS Category", "Hidden"):
			frappe.get_doc({"doctype": "LMS Category", "category": "Hidden"}).insert(ignore_permissions=True)
			self.cleanup_items.append(("LMS Category", "Hidden"))

		draft = frappe.new_doc("LMS Course")
		draft.update(
			{
				"title": "Draft Utility Course",
				"short_introduction": "Draft",
				"description": "Draft description.",
				"category": "Hidden",
				"published": 0,
				"instructors": [{"instructor": "frappe@example.com"}],
			}
		)
		draft.save()
		self.cleanup_items.append(("LMS Course", draft.name))

		labels = [category["label"] for category in get_course_categories()]
		self.assertNotIn("Hidden", labels)

	def test_create_user(self):
		user = create_user(
			email="testuser@example.com", first_name="Test", last_name="User", roles=["LMS Student"]
		)
		self.assertEqual(user.email, "testuser@example.com")
		self.assertEqual(user.first_name, "Test")
		self.assertEqual(user.last_name, "User")
		self.assertEqual(user.full_name, "Test User")
		self.assertIn("LMS Student", [role.role for role in user.roles])
		self.cleanup_items.append(("User", user.name))

	def test_create_user_with_full_name(self):
		user = create_user(
			email="fullnameuser@example.com", full_name="John Michael Doe", roles=["Course Creator"]
		)
		self.assertEqual(user.first_name, "John")
		self.assertEqual(user.last_name, "Michael Doe")
		self.assertEqual(user.full_name, "John Michael Doe")
		self.assertIn("Course Creator", [role.role for role in user.roles])
		self.cleanup_items.append(("User", user.name))


# Fixture-free (no DB) coverage for the lesson-content EditorJS-JSON guard.
# The content field can hold non-JSON (e.g. a lesson edited from the Desk form,
# whose raw textarea has no EditorJS editor). Every reader must fail soft.
import unittest  # noqa: E402

from lms.lms.utils import get_editorjs_blocks, get_lesson_icon  # noqa: E402


def _content(*blocks):
	return frappe.as_json({"blocks": list(blocks)})


class TestGetEditorjsBlocks(unittest.TestCase):
	def test_non_json_content_returns_empty(self):
		# Exact repro from the reported bug: a raw video URL in the content field.
		for raw in ("https://www.youtube.com/watch?v=htpg8CuD1Ec", "", "plain", "<p>x</p>"):
			with self.subTest(raw=raw):
				self.assertEqual(get_editorjs_blocks(raw), [])

	def test_non_string_or_non_object_returns_empty(self):
		for raw in (None, 123, "[]", '["a"]', "null", "{}", '{"blocks": null}'):
			with self.subTest(raw=raw):
				self.assertEqual(get_editorjs_blocks(raw), [])

	def test_valid_editorjs_returns_blocks(self):
		blocks = get_editorjs_blocks(_content({"type": "header", "data": {"text": "Hi"}}))
		self.assertEqual(len(blocks), 1)
		self.assertEqual(blocks[0]["type"], "header")

	def test_non_dict_blocks_are_filtered_out(self):
		# Valid JSON envelope, but the blocks list holds junk. Readers call block.get(...),
		# so anything that isn't a dict must be dropped rather than reaching them.
		content = frappe.as_json(
			{"blocks": ["a string", None, 42, ["nested"], {"type": "header", "data": {}}]}
		)
		blocks = get_editorjs_blocks(content)
		self.assertEqual([b["type"] for b in blocks], ["header"])

	def test_blocks_with_non_dict_data_are_filtered_out(self):
		# The block is a dict but its `data` is present and not a dict; readers do
		# block.get("data", {}).get(...) / block["data"][...], so these must be dropped.
		# null counts as present-but-non-dict (a `.get("data", {})` guard wouldn't catch it).
		# Only a block with a dict data or no data key at all survives.
		content = frappe.as_json(
			{
				"blocks": [
					{"type": "quiz", "data": "x"},
					{"type": "quiz", "data": ["a"]},
					{"type": "quiz", "data": 5},
					{"type": "quiz", "data": None},
					{"type": "header"},
					{"type": "paragraph", "data": {"text": "ok"}},
				]
			}
		)
		blocks = get_editorjs_blocks(content)
		self.assertEqual([b["type"] for b in blocks], ["header", "paragraph"])


class TestGetLessonIcon(unittest.TestCase):
	"""get_lesson_icon builds the course-outline icons; before the guard a single
	lesson with non-JSON content 500'd the whole lesson list for every viewer.
	"""

	def test_non_json_content_falls_back_without_raising(self):
		# Must NOT raise; with no recognisable blocks it falls through to the list icon.
		self.assertEqual(get_lesson_icon("", "https://youtu.be/x"), "icon-list")

	def test_video_embed_icon(self):
		for service in ("youtube", "vimeo", "cloudflareStream", "bunnyStream"):
			with self.subTest(service=service):
				content = _content({"type": "embed", "data": {"service": service}})
				self.assertEqual(get_lesson_icon("", content), "icon-youtube")

	def test_video_upload_icon(self):
		content = _content({"type": "upload", "data": {"file_type": "mp4"}})
		self.assertEqual(get_lesson_icon("", content), "icon-youtube")

	def test_quiz_assignment_program_icons(self):
		cases = {
			"quiz": "icon-quiz",
			"assignment": "icon-assignment",
			"program": "icon-code",
		}
		for block_type, icon in cases.items():
			with self.subTest(block_type=block_type):
				content = _content({"type": block_type, "data": {}})
				self.assertEqual(get_lesson_icon("", content), icon)

	def test_malformed_blocks_do_not_raise(self):
		# Valid JSON whose upload/embed blocks are missing `data` or the field the reader
		# reaches for. Each must fall through to the list icon, never AttributeError.
		for block in (
			{"type": "upload"},
			{"type": "upload", "data": {}},
			{"type": "upload", "data": {"file_type": None}},
			{"type": "embed"},
			{"type": "embed", "data": {}},
		):
			with self.subTest(block=block):
				self.assertEqual(get_lesson_icon("", _content(block)), "icon-list")
