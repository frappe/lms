# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import json
import unittest
from unittest.mock import patch

import frappe
from frappe.utils import add_to_date, now_datetime

from lms.lms.doctype.course_lesson.course_lesson import (
	UNTITLED_LESSON_TITLE,
	rename_settled_untitled_lessons,
)
from lms.lms.test_helpers import BaseTestUtils

IGNORE_TEST_RECORD_DEPENDENCIES = ["Course Chapter", "LMS Course"]

# One sample URL per embed service registered in the LMS EditorJS editor.
# Source of truth: frontend/src/utils/index.js → getEditorTools() → embed.config.services.
# Keep this in sync with that list when a service is added/removed.
EMBED_SERVICE_URLS = {
	"youtube": "https://www.youtube.com/watch?v=htpg8CuD1Ec",
	"vimeo": "https://vimeo.com/123456789",
	"cloudflareStream": "https://customer-f33zs165nr7gyfy4.cloudflarestream.com/"
	+ "0d8e1b2c3a4f5d6e7c8b9a0f1e2d3c4b/watch",
	"bunnyStream": "https://iframe.mediadelivery.net/play/12345/abc-def-123",
	"codepen": "https://codepen.io/team/codepen/pen/PNaGbb",
	"aparat": "https://www.aparat.com/v/AbCdE",
	"github": "https://gist.github.com/octocat/6cad326836d38bd3a7ae",
	"slides": "https://docs.google.com/presentation/d/1A2B3C4D5E/pub",
	"drive": "https://drive.google.com/file/d/1A2B3C4D5E/view",
	"docsPublic": "https://docs.google.com/document/d/1A2B3C4D5E/edit",
	"sheetsPublic": "https://docs.google.com/spreadsheets/d/1A2B3C4D5E/edit",
	"slidesPublic": "https://docs.google.com/presentation/d/1A2B3C4D5E/edit",
	"codesandbox": "https://codesandbox.io/s/new",
}


def _embed_block(service, source):
	"""An EditorJS `embed` block as the editor persists it (type + data only matter here)."""
	return {
		"type": "embed",
		"data": {
			"service": service,
			"source": source,
			"embed": source,
			"width": 580,
			"height": 320,
			"caption": "",
		},
	}


# One sample of every non-embed block type the LMS editor can produce.
# Source of truth: the same getEditorTools() tools map.
NON_EMBED_BLOCKS = {
	"header": {"type": "header", "data": {"text": "Intro", "level": 2}},
	"paragraph": {"type": "paragraph", "data": {"text": "Hello"}},
	"markdown": {"type": "markdown", "data": {"text": "# Hello"}},
	"list": {"type": "list", "data": {"style": "ordered", "items": ["a", "b"]}},
	"table": {"type": "table", "data": {"content": [["a", "b"], ["c", "d"]]}},
	"image": {"type": "image", "data": {"url": "/files/x.png"}},
	"codeBox": {"type": "codeBox", "data": {"code": "x = 1", "language": "python"}},
	"upload": {"type": "upload", "data": {"file": {"url": "/files/x.mp4"}, "quizzes": []}},
	"program": {"type": "program", "data": {"program": "PROG-0001"}},
	"quiz": {"type": "quiz", "data": {"quiz": "QUIZ-0001"}},
	"assignment": {"type": "assignment", "data": {"assignment": "ASSIGN-0001"}},
}


def _content(*blocks):
	"""Wrap blocks in the EditorJS save() envelope that the `content` field stores."""
	return json.dumps({"time": 0, "version": "2.30.0", "blocks": list(blocks)})


class TestApplyEnforcementFlags(unittest.TestCase):
	def _call(self, *, quiz_done, assignment_done, enforce_quiz, enforce_assignment):
		from lms.lms.doctype.course_lesson.course_lesson import (
			apply_enforcement_flags,
		)

		settings = {
			"enforce_quiz_completion": enforce_quiz,
			"enforce_assignment_completion": enforce_assignment,
		}
		return apply_enforcement_flags(
			quiz_done=quiz_done,
			assignment_done=assignment_done,
			settings=settings,
		)

	def test_both_enforced_passes_through(self):
		self.assertEqual(
			self._call(quiz_done=True, assignment_done=True, enforce_quiz=1, enforce_assignment=1),
			(True, True),
		)
		self.assertEqual(
			self._call(quiz_done=False, assignment_done=True, enforce_quiz=1, enforce_assignment=1),
			(False, True),
		)
		self.assertEqual(
			self._call(quiz_done=True, assignment_done=False, enforce_quiz=1, enforce_assignment=1),
			(True, False),
		)


class _DictSubclass(dict):
	"""A frappe._dict-like subclass: the helper must duck-type, not isinstance-check."""


class TestApplyEnforcementFlagsEdgeCases(unittest.TestCase):
	QUIZ_OFF = {"enforce_quiz_completion": 0, "enforce_assignment_completion": 1}
	ASSIGNMENT_OFF = {"enforce_quiz_completion": 1, "enforce_assignment_completion": 0}
	BOTH_OFF = {"enforce_quiz_completion": 0, "enforce_assignment_completion": 0}
	STRING_ZERO = {"enforce_quiz_completion": "0", "enforce_assignment_completion": "0"}
	STRING_ONE = {"enforce_quiz_completion": "1", "enforce_assignment_completion": "1"}
	NONE_QUIZ = {"enforce_quiz_completion": None, "enforce_assignment_completion": 1}

	def setUp(self):
		from lms.lms.doctype.course_lesson.course_lesson import (
			apply_enforcement_flags,
		)

		self.fn = apply_enforcement_flags

	def test_a_flag_is_enforced_unless_it_is_explicitly_falsy(self):
		"""Enforcement is the default: only a genuinely falsy flag turns it off, and a
		missing key is not falsy because dict.get supplies 1."""
		cases = [
			# case, quiz_done, assignment_done, settings, expected
			("quiz_off", False, False, self.QUIZ_OFF, (True, False)),
			("assignment_off", False, False, self.ASSIGNMENT_OFF, (False, True)),
			("missing_keys_stay_enforced", False, True, {}, (False, True)),
			("both_off_and_both_done", True, True, self.BOTH_OFF, (True, True)),
			("both_off_and_quiz_done", True, False, self.BOTH_OFF, (True, True)),
			("both_off_and_assignment_done", False, True, self.BOTH_OFF, (True, True)),
			("both_off_and_neither_done", False, False, self.BOTH_OFF, (True, True)),
			# "0" is a non-empty string, so it is truthy and still reads as enforced.
			# Callers that hit this should pass int(value) explicitly.
			("string_zero_is_truthy", False, False, self.STRING_ZERO, (False, False)),
			("string_one_both_done", True, True, self.STRING_ONE, (True, True)),
			("string_one_quiz_undone", False, True, self.STRING_ONE, (False, True)),
			# Present-but-None is falsy, unlike a missing key.
			("none_disables", False, False, self.NONE_QUIZ, (True, False)),
			("dict_subclass_is_duck_typed", False, False, _DictSubclass(self.QUIZ_OFF), (True, False)),
		]
		for case, quiz_done, assignment_done, settings, expected in cases:
			with self.subTest(case=case):
				got = self.fn(quiz_done=quiz_done, assignment_done=assignment_done, settings=settings)
				self.assertEqual(got, expected)

	def test_does_not_mutate_settings(self):
		settings = {"enforce_quiz_completion": 1, "enforce_assignment_completion": 0}
		snapshot = dict(settings)
		self.fn(quiz_done=True, assignment_done=False, settings=settings)
		self.assertEqual(settings, snapshot)


class TestServePrivateFileVersionSafe(unittest.TestCase):
	"""serve_resource must not pass `filename=` to a Frappe whose send_private_file
	predates that kwarg (LMS supports frappe>=14). Regression for the student-view 500:
	TypeError: send_private_file() got an unexpected keyword argument 'filename'."""

	def _run(self, stub):
		from lms.lms.doctype.course_lesson import course_lesson

		original = course_lesson.send_private_file
		course_lesson.send_private_file = stub
		try:
			return course_lesson._serve_private_file("/files/x.pdf", "nice.pdf")
		finally:
			course_lesson.send_private_file = original

	def test_old_frappe_without_filename_kwarg(self):
		calls = []

		def old_stub(path):  # pre-filename Frappe: only accepts the path
			calls.append((path,))
			return "sent"

		self.assertEqual(self._run(old_stub), "sent")
		self.assertEqual(calls, [("/files/x.pdf",)])

	def test_new_frappe_passes_filename(self):
		calls = []

		def new_stub(path, filename=None):
			calls.append((path, filename))
			return "sent"

		self.assertEqual(self._run(new_stub), "sent")
		self.assertEqual(calls, [("/files/x.pdf", "nice.pdf")])


class TestGetEditorjsBlocks(unittest.TestCase):
	"""get_editorjs_blocks underpins save_lesson_details_in_quiz, get_quiz_progress and
	get_assignment_progress. Before it existed those did a bare json.loads(content) which
	500'd when `content` wasn't EditorJS JSON, e.g. a raw video URL pasted into the Desk
	Course Lesson form (the original bug: JSONDecodeError in on_update).
	"""

	def setUp(self):
		from lms.lms.doctype.course_lesson.course_lesson import get_editorjs_blocks

		self.fn = get_editorjs_blocks

	# --- The regression: non-EditorJS content must not raise -------------------

	def test_raw_youtube_url_as_content_returns_empty(self):
		"""Exact repro from the reported traceback: a YouTube URL in the content field."""
		self.assertEqual(self.fn("https://www.youtube.com/watch?v=htpg8CuD1Ec"), [])

	def test_non_json_inputs_return_empty(self):
		for raw in ("", "   ", "plain text", "https://vimeo.com/123", "<p>html</p>"):
			with self.subTest(raw=raw):
				self.assertEqual(self.fn(raw), [])

	def test_non_string_inputs_return_empty(self):
		for raw in (None, 123, [], {}):
			with self.subTest(raw=raw):
				self.assertEqual(self.fn(raw), [])

	def test_json_but_not_an_object_returns_empty(self):
		# Valid JSON that isn't an EditorJS envelope (a list, a bare string/number).
		for raw in ("[]", '["a", "b"]', '"a string"', "42", "null"):
			with self.subTest(raw=raw):
				self.assertEqual(self.fn(raw), [])

	def test_object_without_or_with_null_blocks_returns_empty(self):
		for raw in ("{}", '{"version": "2.30.0"}', '{"blocks": null}', '{"blocks": []}'):
			with self.subTest(raw=raw):
				self.assertEqual(self.fn(raw), [])

	# --- Every block / embed the editor can produce parses cleanly -------------

	def test_every_non_embed_block_type_parses(self):
		for name, block in NON_EMBED_BLOCKS.items():
			with self.subTest(block=name):
				blocks = self.fn(_content(block))
				self.assertEqual(len(blocks), 1)
				self.assertEqual(blocks[0]["type"], block["type"])

	def test_every_embed_service_parses(self):
		for service, url in EMBED_SERVICE_URLS.items():
			with self.subTest(service=service):
				blocks = self.fn(_content(_embed_block(service, url)))
				self.assertEqual(len(blocks), 1)
				self.assertEqual(blocks[0]["type"], "embed")
				self.assertEqual(blocks[0]["data"]["service"], service)

	def test_mixed_document_preserves_order_and_count(self):
		blocks = [
			NON_EMBED_BLOCKS["header"],
			_embed_block("youtube", EMBED_SERVICE_URLS["youtube"]),
			NON_EMBED_BLOCKS["paragraph"],
			_embed_block("vimeo", EMBED_SERVICE_URLS["vimeo"]),
			NON_EMBED_BLOCKS["quiz"],
		]
		parsed = self.fn(_content(*blocks))
		self.assertEqual([b["type"] for b in parsed], [b["type"] for b in blocks])


class TestLessonBlockExtraction(unittest.TestCase):
	"""The block-type filtering that save_lesson_details_in_quiz / get_quiz_progress /
	get_assignment_progress run on top of get_editorjs_blocks. Pure (no DB): asserts which
	blocks surface a quiz/assignment id and, crucially, that embeds surface neither, so a
	lesson made entirely of video embeds never reaches the DB-lookup branches.
	"""

	def setUp(self):
		from lms.lms.doctype.course_lesson.course_lesson import get_editorjs_blocks

		self.fn = get_editorjs_blocks

	def _quiz_ids(self, content):
		ids = []
		for block in self.fn(content):
			if block.get("type") == "quiz":
				ids.append(block["data"].get("quiz"))
			if block.get("type") == "upload":
				for row in block["data"].get("quizzes") or []:
					ids.append(row.get("quiz"))
		return ids

	def _assignment_ids(self, content):
		return [b["data"].get("assignment") for b in self.fn(content) if b.get("type") == "assignment"]

	def test_quiz_block_yields_quiz_id(self):
		self.assertEqual(self._quiz_ids(_content(NON_EMBED_BLOCKS["quiz"])), ["QUIZ-0001"])

	def test_upload_block_yields_inline_quiz_ids(self):
		upload = {
			"type": "upload",
			"data": {"file": {"url": "/files/x.mp4"}, "quizzes": [{"quiz": "QUIZ-9"}]},
		}
		self.assertEqual(self._quiz_ids(_content(upload)), ["QUIZ-9"])

	def test_assignment_block_yields_assignment_id(self):
		self.assertEqual(self._assignment_ids(_content(NON_EMBED_BLOCKS["assignment"])), ["ASSIGN-0001"])

	def test_embeds_surface_no_quiz_or_assignment(self):
		for service, url in EMBED_SERVICE_URLS.items():
			with self.subTest(service=service):
				content = _content(_embed_block(service, url))
				self.assertEqual(self._quiz_ids(content), [])
				self.assertEqual(self._assignment_ids(content), [])

	def test_raw_url_content_surfaces_nothing(self):
		# The reported crash case: extraction yields nothing instead of raising.
		self.assertEqual(self._quiz_ids("https://www.youtube.com/watch?v=htpg8CuD1Ec"), [])
		self.assertEqual(self._assignment_ids("https://www.youtube.com/watch?v=htpg8CuD1Ec"), [])


class TestRenameSettledUntitledLessons(BaseTestUtils):
	"""Keep the scheduled job's commits inside the test transaction."""

	def setUp(self):
		super().setUp()
		commit_patcher = patch.object(frappe.db, "commit")
		commit_patcher.start()
		self.addCleanup(commit_patcher.stop)
		# _create_course() defaults instructor="frappe@example.com"; create it so the
		# course's instructor Link resolves on a fresh DB (mirrors TestLMSCourse.setUp).
		self.instructor = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"]
		)
		self.course = self._create_course(title=f"Rename Untitled Course {frappe.generate_hash(length=6)}")
		self.chapter = self._create_chapter("Rename Chapter", self.course.name)

	def _make_untitled_lesson(self):
		lesson = self._create_lesson(UNTITLED_LESSON_TITLE, self.chapter.name, self.course.name)
		self.assertTrue(lesson.name.endswith(f" {UNTITLED_LESSON_TITLE}"))
		return lesson

	def _retitle(self, lesson, title):
		frappe.db.set_value("Course Lesson", lesson.name, "title", title, update_modified=False)

	def _age_modified(self, name, days):
		frappe.db.set_value(
			"Course Lesson", name, "modified", add_to_date(now_datetime(), days=days), update_modified=False
		)

	def test_settled_lesson_is_renamed(self):
		lesson = self._make_untitled_lesson()
		prefix = lesson.name.split(" ", 1)[0]
		self._retitle(lesson, "Real Title")
		self._age_modified(lesson.name, days=-2)

		rename_settled_untitled_lessons()

		expected = f"{prefix} Real Title"
		self.assertFalse(frappe.db.exists("Course Lesson", lesson.name))
		self.assertTrue(frappe.db.exists("Course Lesson", expected))

	def test_recently_modified_lesson_is_not_renamed(self):
		lesson = self._make_untitled_lesson()
		self._retitle(lesson, "Fresh Edit")

		rename_settled_untitled_lessons()

		self.assertTrue(frappe.db.exists("Course Lesson", lesson.name))

	def test_still_untitled_lesson_is_not_renamed(self):
		lesson = self._make_untitled_lesson()
		self._age_modified(lesson.name, days=-2)

		rename_settled_untitled_lessons()

		self.assertTrue(frappe.db.exists("Course Lesson", lesson.name))

	def test_translated_placeholder_lesson_is_renamed(self):
		translated = "Titre provisoire"
		lang = "fr"
		user = self._create_user("french-author@example.com", "French", "Author", ["LMS Student"])
		frappe.db.set_value("User", user.name, "language", lang)

		lesson = self._create_lesson(translated, self.chapter.name, self.course.name)
		self.assertTrue(lesson.name.endswith(f" {translated}"))
		prefix = lesson.name.split(" ", 1)[0]
		self._retitle(lesson, "Titre Réel")
		self._age_modified(lesson.name, days=-2)

		def fake_translations(target_lang):
			return {UNTITLED_LESSON_TITLE: translated} if target_lang == lang else {}

		with patch("frappe.translate.get_all_translations", side_effect=fake_translations):
			rename_settled_untitled_lessons()

		expected = f"{prefix} Titre Réel"
		self.assertFalse(frappe.db.exists("Course Lesson", lesson.name))
		self.assertTrue(frappe.db.exists("Course Lesson", expected))


class TestLessonContentSurvivesSave(BaseTestUtils):
	r"""`content` holds JSON, not HTML.

	frappe's field-level `sanitize_html` used to run over the whole envelope and
	rewrite every `\"` inside it to `\&quot;`, so any inline tool that emits an
	attribute (link, inline code, colour) left the field unparseable and the
	lesson body unreadable. `ignore_xss_filter` on the field stops that; the real
	gate is `sanitize_editorjs`, which walks the parsed document string by string.
	"""

	# Kept verbatim by the sanitiser. A link is not here: nh3 deliberately adds
	# rel="noopener noreferrer" to every <a>, so it is asserted separately below.
	ATTRIBUTE_MARKUP = {
		"inline_code": '<code class="inline-code">code</code>',
		"colour": '<span class="lms-inline-color" style="color:rgb(255, 0, 0)">tint</span>',
	}

	def setUp(self):
		super().setUp()
		# _create_course() defaults instructor="frappe@example.com"; create it so the
		# course's instructor Link resolves on a fresh DB.
		self._create_user("frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"])
		self.course = self._create_course(title="Inline Markup Course")
		self.chapter = self._create_chapter("Inline Markup Chapter", self.course.name)

	def _saved_text(self, markup, title):
		content = _content({"id": "b1", "type": "paragraph", "data": {"text": markup}})
		lesson = self._create_lesson(title, self.chapter.name, self.course.name, content)
		stored = frappe.db.get_value("Course Lesson", lesson.name, "content")
		return json.loads(stored)["blocks"][0]["data"]["text"]

	def test_field_is_exempt_from_frappe_html_sanitiser(self):
		"""Guards the docfield property the rest of this class depends on."""
		meta = frappe.get_meta("Course Lesson")
		for fieldname in ("content", "instructor_content"):
			self.assertTrue(
				meta.get_field(fieldname).get("ignore_xss_filter"),
				f"{fieldname} must carry ignore_xss_filter; run bench migrate",
			)

	def test_attribute_bearing_inline_markup_round_trips(self):
		for name, markup in self.ATTRIBUTE_MARKUP.items():
			with self.subTest(markup=name):
				self.assertEqual(self._saved_text(markup, f"Lesson {name}"), markup)

	def test_link_keeps_its_href_and_gains_rel(self):
		saved = self._saved_text('<a href="https://frappe.io/">here</a>', "Lesson link")
		self.assertIn('href="https://frappe.io/"', saved)
		self.assertIn('rel="noopener noreferrer"', saved)


class TestServeResourceFileOwnership(BaseTestUtils):
	"""Ticket 73894 finding E05. A lesson only vouches for a private file if the
	file's OWNER authors that lesson's course.

	Without that rule serve_resource served any private file the caller could *name*
	from a lesson they control: paste the url into a lesson you author, or repoint the
	File's attached_to_name at it, and the can_access_lesson gate then passes on your
	own lesson (ticket 73894, finding E05).
	"""

	SERVED = "authz-passed"
	DENIED = "permission-error"

	def setUp(self):
		super().setUp()
		suffix = frappe.generate_hash(length=6)

		self.author = self._creator(f"lesson-file-owner-{suffix}@example.com", "Owner", "A")
		self.attacker = self._creator(f"lesson-file-attacker-{suffix}@example.com", "Attacker", "B")
		self.outsider = self._creator(f"lesson-file-outsider-{suffix}@example.com", "Outsider", "C")
		self.student = self._create_user(
			f"lesson-file-student-{suffix}@example.com", "Enrolled", "Student", ["LMS Student"]
		).name

		self.course_a, self.lesson_a = self._course_with_lesson(f"Owner A {suffix}", self.author)
		self.course_b, self.lesson_b = self._course_with_lesson(f"Attacker B {suffix}", self.attacker)
		self._create_enrollment(self.student, self.course_a)

		self.file_url = self._private_file(owner=self.author, lesson=self.lesson_a)
		self._embed(self.lesson_a, self.file_url)

	def _creator(self, email, first_name, last_name):
		return self._create_user(email, first_name, last_name, ["Course Creator"]).name

	def _course_with_lesson(self, label, instructor):
		course = self._create_course(title=f"{label} Course", instructor=instructor).name
		chapter = self._create_chapter(f"{label} Chapter", course).name
		return course, self._create_lesson(f"{label} Lesson", chapter, course).name

	def _private_file(self, owner, lesson):
		"""A private File carrying real bytes, owned by `owner` and attached to `lesson`."""
		frappe.set_user(owner)
		try:
			# Fixture setup, not the thing under test: this site's Course Creator
			# DocPerm on Course Lesson is if_owner.
			# nosemgrep: lms-unjustified-ignore-permissions
			file = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": f"secret-{frappe.generate_hash(length=8)}.txt",
					"is_private": 1,
					"content": "owner-only bytes",
					"attached_to_doctype": "Course Lesson",
					"attached_to_name": lesson,
					"attached_to_field": "content",
				}
			).insert(ignore_permissions=True)
		finally:
			frappe.set_user("Administrator")

		self.assertEqual(file.owner, owner)
		# The transaction rollback does not unlink what was written to disk.
		self.addCleanup(self._unlink, file.get_full_path())
		return file.file_url

	@staticmethod
	def _unlink(path):
		import os

		if os.path.exists(path):
			os.remove(path)

	def _embed(self, lesson, url):
		"""Put the url in the lesson body, bypassing the form (fixture setup, not the
		thing under test — on this site a Course Creator's DocPerm is if_owner)."""
		content = _content({"type": "paragraph", "data": {"text": f'<img src="{url}">'}})
		frappe.db.set_value("Course Lesson", lesson, "content", content, update_modified=False)

	def _serve_as(self, user):
		"""Run the endpoint in `user`'s own session and classify the outcome.

		There is no request in a test runner, so a call that PASSES authorization dies
		inside send_private_file with ``AttributeError: request``. Only
		frappe.PermissionError is a denial.
		"""
		from lms.lms.doctype.course_lesson.course_lesson import serve_resource

		frappe.set_user(user)
		try:
			serve_resource(self.file_url)
			return self.SERVED
		except frappe.PermissionError:
			return self.DENIED
		except AttributeError as e:
			if "request" not in str(e):
				raise
			return self.SERVED
		finally:
			frappe.set_user("Administrator")

	# --- the attacks ---------------------------------------------------------

	def test_embedding_the_url_in_your_own_lesson_does_not_grant_access(self):
		self._embed(self.lesson_b, self.file_url)
		self.assertEqual(self._serve_as(self.attacker), self.DENIED)

	def test_repointing_the_attachment_at_your_own_lesson_does_not_grant_access(self):
		frappe.db.set_value("File", {"file_url": self.file_url}, "attached_to_name", self.lesson_b)
		self.assertEqual(self._serve_as(self.attacker), self.DENIED)

	def test_an_unrelated_course_creator_is_denied(self):
		self.assertEqual(self._serve_as(self.outsider), self.DENIED)

	# --- what must keep working ----------------------------------------------

	def test_the_author_still_gets_their_own_file(self):
		self.assertEqual(self._serve_as(self.author), self.SERVED)

	def test_an_enrolled_student_still_gets_the_lesson_media(self):
		self.assertEqual(self._serve_as(self.student), self.SERVED)

	def test_a_preview_guest_still_gets_the_lesson_media(self):
		frappe.db.set_value("Course Lesson", self.lesson_a, "include_in_preview", 1, update_modified=False)
		frappe.db.set_value("LMS Course", self.course_a, "published", 1, update_modified=False)
		previous = frappe.db.get_single_value("LMS Settings", "allow_guest_access")
		frappe.db.set_single_value("LMS Settings", "allow_guest_access", 1)
		self.addCleanup(frappe.db.set_single_value, "LMS Settings", "allow_guest_access", previous)
		self.addCleanup(frappe.clear_cache)

		self.assertEqual(self._serve_as("Guest"), self.SERVED)

	def test_a_file_owned_by_a_moderator_resolves_in_any_lesson(self):
		"""A moderator may legitimately place a file in any course, so their file is
		vouched for by every lesson that references it."""
		moderator = self._create_user(
			f"lesson-file-mod-{frappe.generate_hash(length=6)}@example.com",
			"Mod",
			"Erator",
			["Moderator", "Course Creator"],
		).name
		self.file_url = self._private_file(owner=moderator, lesson=self.lesson_b)
		self._embed(self.lesson_b, self.file_url)

		self.assertEqual(self._serve_as(self.attacker), self.SERVED)
		self.assertEqual(self._serve_as(self.outsider), self.DENIED)
