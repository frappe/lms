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
from lms.lms.utils import can_modify_course

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


class TestServeResourceAfterInstructorChange(BaseTestUtils):
	"""An instructor who uploaded private lesson media is later dropped from the
	course's instructors. Vouching the reference on the owner's CURRENT authorship
	alone then denied the file to everyone -- the enrolled learners the lesson was
	written for included -- because no surviving reference vouched for it.

	The lesson the owner created still vouches for it: Course Creator write on
	Course Lesson is if_owner, so nobody but the lesson's own author (or a
	moderator, who vouches for every course anyway) could have put the file there,
	and `owner` is stamped from the session on insert and cannot be reassigned by an
	if_owner writer. Access stays exactly the lesson's audience -- can_access_lesson
	still runs, unchanged, over the surviving references.
	"""

	SERVED = "authz-passed"
	DENIED = "permission-error"

	def setUp(self):
		super().setUp()
		suffix = frappe.generate_hash(length=6)

		self.author = self._create_user(
			f"left-course-author-{suffix}@example.com", "Gone", "Author", ["Course Creator"]
		).name
		self.attacker = self._create_user(
			f"left-course-attacker-{suffix}@example.com", "Other", "Creator", ["Course Creator"]
		).name
		self.student = self._create_user(
			f"left-course-student-{suffix}@example.com", "Enrolled", "Student", ["LMS Student"]
		).name
		self.outsider = self._create_user(
			f"left-course-outsider-{suffix}@example.com", "Unenrolled", "Student", ["LMS Student"]
		).name

		self.course = self._create_course(title=f"Left Course {suffix}", instructor=self.author).name
		chapter = self._create_chapter(f"Left Chapter {suffix}", self.course).name
		self.lesson = self._create_lesson(f"Left Lesson {suffix}", chapter, self.course).name
		frappe.db.set_value("Course Lesson", self.lesson, "owner", self.author, update_modified=False)
		self._create_enrollment(self.student, self.course)

		self.file_url = self._private_file(owner=self.author, lesson=self.lesson)
		content = _content({"type": "paragraph", "data": {"text": f'<img src="{self.file_url}">'}})
		frappe.db.set_value("Course Lesson", self.lesson, "content", content, update_modified=False)

	def _private_file(self, owner, lesson):
		frappe.set_user(owner)
		try:
			# Fixture setup, not the thing under test.
			# nosemgrep: lms-unjustified-ignore-permissions
			file = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": f"handover-{frappe.generate_hash(length=8)}.txt",
					"is_private": 1,
					"content": "course media the learners paid for",
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

	def _drop_from_instructors(self, user):
		frappe.db.delete(
			"Course Instructor", {"parent": self.course, "parenttype": "LMS Course", "instructor": user}
		)
		frappe.set_user(user)
		try:
			self.assertFalse(can_modify_course(self.course), msg="fixture: the drop must have landed")
		finally:
			frappe.set_user("Administrator")

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

	def test_enrolled_learner_keeps_the_media_after_the_uploader_is_dropped(self):
		self._drop_from_instructors(self.author)
		self.assertEqual(self._serve_as(self.student), self.SERVED)

	def test_a_replacement_instructor_gets_the_media(self):
		self._drop_from_instructors(self.author)
		replacement = self._create_user(
			f"left-course-replacement-{frappe.generate_hash(length=6)}@example.com",
			"New",
			"Instructor",
			["Course Creator"],
		).name
		course = frappe.get_doc("LMS Course", self.course)
		course.append("instructors", {"instructor": replacement})
		# Fixture setup, not the thing under test: appending an instructor is an
		# authoring action the dropped author no longer has.
		# nosemgrep: lms-unjustified-ignore-permissions
		course.save(ignore_permissions=True)

		self.assertEqual(self._serve_as(replacement), self.SERVED)

	def test_an_unenrolled_account_is_still_denied_after_the_drop(self):
		"""The boundary must not move: leaving the course does not make the file public."""
		self._drop_from_instructors(self.author)
		self.assertEqual(self._serve_as(self.outsider), self.DENIED)
		self.assertEqual(self._serve_as(self.attacker), self.DENIED)

	def test_the_owners_own_other_lesson_cannot_adopt_a_different_file(self):
		"""Same owner on both rows is not enough: the dropped author still owns
		self.lesson (if_owner ignores course membership) and could paste an unrelated
		file's url into it. That file really lives in a different lesson."""
		self._drop_from_instructors(self.author)
		suffix = frappe.generate_hash(length=6)
		other_course = self._create_course(title=f"Elsewhere Course {suffix}", instructor=self.author).name
		other_chapter = self._create_chapter(f"Elsewhere Chapter {suffix}", other_course).name
		other_lesson = self._create_lesson(f"Elsewhere Lesson {suffix}", other_chapter, other_course).name
		# Distinct bytes: frappe dedupes identical file content onto one File row, which
		# would collide with self.file_url from setUp and defeat this test's premise.
		frappe.set_user(self.author)
		try:
			# nosemgrep: lms-unjustified-ignore-permissions
			other_file = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": f"elsewhere-{frappe.generate_hash(length=8)}.txt",
					"is_private": 1,
					"content": f"unrelated course media {frappe.generate_hash(length=8)}",
					"attached_to_doctype": "Course Lesson",
					"attached_to_name": other_lesson,
					"attached_to_field": "content",
				}
			).insert(ignore_permissions=True)
		finally:
			frappe.set_user("Administrator")
		self.addCleanup(self._unlink, other_file.get_full_path())
		other_file_url = other_file.file_url

		# self.author still owns self.lesson (if_owner survives leaving the course) and
		# pastes the OTHER file's url into it -- a content match, not a real attachment.
		frappe.db.set_value(
			"Course Lesson",
			self.lesson,
			"content",
			_content({"type": "paragraph", "data": {"text": f'<img src="{other_file_url}">'}}),
			update_modified=False,
		)

		self.file_url = other_file_url
		self.assertEqual(self._serve_as(self.student), self.DENIED)

	def test_another_creator_still_cannot_adopt_the_orphaned_file(self):
		"""The lesson that vouches is the one its OWNER created, not any lesson naming
		the url: pasting it into your own lesson must still not serve it."""
		self._drop_from_instructors(self.author)
		suffix = frappe.generate_hash(length=6)
		their_course = self._create_course(title=f"Adopting Course {suffix}", instructor=self.attacker).name
		their_chapter = self._create_chapter(f"Adopting Chapter {suffix}", their_course).name
		their_lesson = self._create_lesson(f"Adopting Lesson {suffix}", their_chapter, their_course).name
		frappe.db.set_value("Course Lesson", their_lesson, "owner", self.attacker, update_modified=False)
		frappe.db.set_value(
			"Course Lesson",
			their_lesson,
			"content",
			_content({"type": "paragraph", "data": {"text": f'<img src="{self.file_url}">'}}),
			update_modified=False,
		)

		self.assertEqual(self._serve_as(self.attacker), self.DENIED)


class TestServeResourceModeratorPlacedMedia(BaseTestUtils):
	"""Course Creator write on Course Lesson is if_owner, so a Moderator is the one
	real way media not uploaded by the lesson's own owner gets genuinely attached
	to it. Losing the Moderator role later must not retroactively deny it."""

	SERVED = "authz-passed"
	DENIED = "permission-error"

	def setUp(self):
		super().setUp()
		suffix = frappe.generate_hash(length=6)

		self.owner = self._create_user(
			f"mod-placed-owner-{suffix}@example.com", "Lesson", "Owner", ["Course Creator"]
		).name
		self.moderator = self._create_user(
			f"mod-placed-mod-{suffix}@example.com", "Former", "Moderator", ["Course Creator", "Moderator"]
		).name
		self.student = self._create_user(
			f"mod-placed-student-{suffix}@example.com", "Enrolled", "Student", ["LMS Student"]
		).name
		self.outsider = self._create_user(
			f"mod-placed-outsider-{suffix}@example.com", "Unenrolled", "Student", ["LMS Student"]
		).name

		self.course = self._create_course(title=f"Mod Placed Course {suffix}", instructor=self.owner).name
		chapter = self._create_chapter(f"Mod Placed Chapter {suffix}", self.course).name
		self.lesson = self._create_lesson(f"Mod Placed Lesson {suffix}", chapter, self.course).name
		self._create_enrollment(self.student, self.course)

		self.file_url = self._private_file(owner=self.moderator, lesson=self.lesson)
		content = _content({"type": "paragraph", "data": {"text": f'<img src="{self.file_url}">'}})
		frappe.db.set_value("Course Lesson", self.lesson, "content", content, update_modified=False)

	def _private_file(self, owner, lesson):
		frappe.set_user(owner)
		try:
			# Fixture setup, not the thing under test: a Moderator attaching media to a
			# lesson they do not own.
			# nosemgrep: lms-unjustified-ignore-permissions
			file = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": f"mod-upload-{frappe.generate_hash(length=8)}.txt",
					"is_private": 1,
					"content": "media a moderator placed for the class",
					"attached_to_doctype": "Course Lesson",
					"attached_to_name": lesson,
					"attached_to_field": "content",
				}
			).insert(ignore_permissions=True)
		finally:
			frappe.set_user("Administrator")

		self.assertEqual(file.owner, owner)
		self.addCleanup(self._unlink, file.get_full_path())
		return file.file_url

	@staticmethod
	def _unlink(path):
		import os

		if os.path.exists(path):
			os.remove(path)

	def _serve_as(self, user):
		"""See TestServeResourceFileOwnership._serve_as."""
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

	def test_enrolled_learner_keeps_the_media_after_the_moderator_steps_down(self):
		frappe.get_doc("User", self.moderator).remove_roles("Moderator")
		self.assertEqual(self._serve_as(self.student), self.SERVED)

	def test_an_unenrolled_account_is_still_denied_after_the_role_change(self):
		frappe.get_doc("User", self.moderator).remove_roles("Moderator")
		self.assertEqual(self._serve_as(self.outsider), self.DENIED)

	def test_repointing_a_former_moderators_file_after_the_fact_does_not_qualify(self):
		"""attached_to_name is only trusted un-repointed since upload: a later change
		(even to a lesson that keeps making sense) bumps File.modified, so this must
		not fall back to being served on that basis alone."""
		frappe.get_doc("User", self.moderator).remove_roles("Moderator")
		# A separate, unenrolled course: validate_progress_recalculation enqueues a
		# recalculation for every enrollment of a lesson's own course on insert, and
		# self.course already has one from setUp.
		suffix = frappe.generate_hash(length=6)
		other_course = self._create_course(title=f"Retarget Course {suffix}", instructor=self.owner).name
		other_chapter = self._create_chapter(f"Retarget Chapter {suffix}", other_course).name
		other_lesson = self._create_lesson(f"Retarget Lesson {suffix}", other_chapter, other_course).name
		frappe.db.set_value("File", {"file_url": self.file_url}, "attached_to_name", other_lesson)

		self.assertEqual(self._serve_as(self.student), self.DENIED)


class TestServeResourceSecondFileRowForExistingUrl(BaseTestUtils):
	"""A second File row can legitimately point at an existing private url --
	validate_private_file_access only requires the inserter to already be able to
	read it, not to own it. Vouching must bind each attachment to ITS OWN row's
	owner; a row someone else created for that url must never borrow the first
	row's authority, or vice versa.

	Table: who owns row 1 (real bytes) x who owns row 2 (same url, new lesson).
	"""

	SERVED = "authz-passed"
	DENIED = "permission-error"

	def setUp(self):
		super().setUp()
		suffix = frappe.generate_hash(length=6)

		self.author = self._create_user(
			f"row1-author-{suffix}@example.com", "Row", "One", ["Course Creator"]
		).name
		self.co_instructor = self._create_user(
			f"row2-co-{suffix}@example.com", "Row", "Two", ["Course Creator"]
		).name

		self.course1 = self._create_course(title=f"Row1 Course {suffix}", instructor=self.author).name
		course1 = frappe.get_doc("LMS Course", self.course1)
		# co_instructor must already be able to READ row 1 to pass
		# validate_private_file_access when inserting row 2 for the same url.
		course1.append("instructors", {"instructor": self.co_instructor})
		# Fixture setup, not the thing under test.
		# nosemgrep: lms-unjustified-ignore-permissions
		course1.save(ignore_permissions=True)
		chapter1 = self._create_chapter(f"Row1 Chapter {suffix}", self.course1).name
		self.lesson1 = self._create_lesson(f"Row1 Lesson {suffix}", chapter1, self.course1).name
		frappe.db.set_value("Course Lesson", self.lesson1, "owner", self.author, update_modified=False)

		self.viewer1 = self._create_user(
			f"row1-viewer-{suffix}@example.com", "Viewer", "One", ["LMS Student"]
		).name
		self._create_enrollment(self.viewer1, self.course1)

		self.file_url = self._file(owner=self.author, lesson=self.lesson1)

	def _file(self, owner, lesson):
		frappe.set_user(owner)
		try:
			# Fixture setup: this site's Course Creator DocPerm is if_owner.
			# nosemgrep: lms-unjustified-ignore-permissions
			file = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": f"shared-{frappe.generate_hash(length=8)}.txt",
					"is_private": 1,
					"content": "shared private bytes",
					"attached_to_doctype": "Course Lesson",
					"attached_to_name": lesson,
					"attached_to_field": "content",
				}
			).insert(ignore_permissions=True)
		finally:
			frappe.set_user("Administrator")
		self.assertEqual(file.owner, owner)
		self.addCleanup(self._unlink, file.get_full_path())
		return file.file_url

	def _attach_second_row(self, owner, lesson):
		"""A second File row for the SAME url, owned by `owner`, attached to `lesson`.

		Repoints file_url via db.set_value after a normal insert, the same way the
		existing repoint tests simulate a second row landing on an existing url --
		this exercises the vouching code under test, not the upload/dedup pipeline.
		"""
		frappe.set_user(owner)
		try:
			# nosemgrep: lms-unjustified-ignore-permissions
			file = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": f"repointed-{frappe.generate_hash(length=8)}.txt",
					"is_private": 1,
					"content": f"unrelated bytes {frappe.generate_hash(length=8)}",
					"attached_to_doctype": "Course Lesson",
					"attached_to_name": lesson,
					"attached_to_field": "content",
				}
			).insert(ignore_permissions=True)
		finally:
			frappe.set_user("Administrator")
		self.addCleanup(self._unlink, file.get_full_path())
		frappe.db.set_value("File", file.name, "file_url", self.file_url, update_modified=False)

	@staticmethod
	def _unlink(path):
		import os

		if os.path.exists(path):
			os.remove(path)

	def _serve_as(self, user):
		"""See TestServeResourceFileOwnership._serve_as."""
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

	def test_second_row_same_owner_reusing_own_media_is_served_from_both_lessons(self):
		"""Row 2's owner matches row 1: legitimately their own bytes, reused."""
		suffix = frappe.generate_hash(length=6)
		course2 = self._create_course(title=f"Row1 Reuse Course {suffix}", instructor=self.author).name
		chapter2 = self._create_chapter(f"Row1 Reuse Chapter {suffix}", course2).name
		lesson2 = self._create_lesson(f"Row1 Reuse Lesson {suffix}", chapter2, course2).name
		frappe.db.set_value("Course Lesson", lesson2, "owner", self.author, update_modified=False)
		viewer2 = self._create_user(
			f"row1-reuse-viewer-{suffix}@example.com", "Viewer", "Reuse", ["LMS Student"]
		).name
		self._create_enrollment(viewer2, course2)
		self._attach_second_row(self.author, lesson2)

		self.assertEqual(self._serve_as(self.viewer1), self.SERVED)
		self.assertEqual(self._serve_as(viewer2), self.SERVED)

	def test_second_row_different_owner_does_not_leak_into_their_course(self):
		"""Row 2's owner (co_instructor) could already read row 1 via course1 --
		that must not let their own, unrelated course adopt the same bytes."""
		suffix = frappe.generate_hash(length=6)
		course2 = self._create_course(title=f"Row2 Course {suffix}", instructor=self.co_instructor).name
		chapter2 = self._create_chapter(f"Row2 Chapter {suffix}", course2).name
		lesson2 = self._create_lesson(f"Row2 Lesson {suffix}", chapter2, course2).name
		frappe.db.set_value("Course Lesson", lesson2, "owner", self.co_instructor, update_modified=False)
		viewer2 = self._create_user(
			f"row2-viewer-{suffix}@example.com", "Viewer", "Two", ["LMS Student"]
		).name
		self._create_enrollment(viewer2, course2)
		self._attach_second_row(self.co_instructor, lesson2)

		self.assertEqual(self._serve_as(self.viewer1), self.SERVED)
		self.assertEqual(self._serve_as(viewer2), self.DENIED)

	def test_touching_row_one_after_row_two_exists_does_not_change_the_canonical_owner(self):
		"""Canonical ownership is decided by creation order, not by which row was
		modified last -- serve_resource's own row lookup must agree."""
		suffix = frappe.generate_hash(length=6)
		course2 = self._create_course(title=f"Row2 Late Course {suffix}", instructor=self.co_instructor).name
		chapter2 = self._create_chapter(f"Row2 Late Chapter {suffix}", course2).name
		lesson2 = self._create_lesson(f"Row2 Late Lesson {suffix}", chapter2, course2).name
		frappe.db.set_value("Course Lesson", lesson2, "owner", self.co_instructor, update_modified=False)
		self._attach_second_row(self.co_instructor, lesson2)
		# Touch row 1's own metadata after row 2 exists, without changing its owner.
		frappe.db.set_value("File", {"file_url": self.file_url, "owner": self.author}, "file_name", "x.txt")

		self.assertEqual(self._serve_as(self.viewer1), self.SERVED)


class TestServeResourceCoInstructorUpload(BaseTestUtils):
	"""The ordinary co-authoring path: an instructor uploads private media into a lesson
	a DIFFERENT instructor created, and is later dropped from the course. The uploader
	owns neither the lesson nor a current authorship any more, so the reference survives
	on the File row alone -- attached, never edited since, and the upload of record."""

	SERVED = "authz-passed"
	DENIED = "permission-error"

	def setUp(self):
		super().setUp()
		suffix = frappe.generate_hash(length=6)

		self.lesson_author = self._create_user(
			f"co-lesson-author-{suffix}@example.com", "Lesson", "Author", ["Course Creator"]
		).name
		self.uploader = self._create_user(
			f"co-uploader-{suffix}@example.com", "Co", "Instructor", ["Course Creator"]
		).name
		self.student = self._create_user(
			f"co-student-{suffix}@example.com", "Enrolled", "Student", ["LMS Student"]
		).name
		self.outsider = self._create_user(
			f"co-outsider-{suffix}@example.com", "Unenrolled", "Student", ["LMS Student"]
		).name

		self.course = self._create_course(title=f"Co Course {suffix}", instructor=self.lesson_author).name
		course = frappe.get_doc("LMS Course", self.course)
		course.append("instructors", {"instructor": self.uploader})
		# Fixture setup, not the thing under test.
		# nosemgrep: lms-unjustified-ignore-permissions
		course.save(ignore_permissions=True)

		chapter = self._create_chapter(f"Co Chapter {suffix}", self.course).name
		self.lesson = self._create_lesson(f"Co Lesson {suffix}", chapter, self.course).name
		frappe.db.set_value("Course Lesson", self.lesson, "owner", self.lesson_author, update_modified=False)
		self._create_enrollment(self.student, self.course)

		self.file_url = self._private_file(owner=self.uploader, lesson=self.lesson)
		frappe.db.set_value(
			"Course Lesson",
			self.lesson,
			"content",
			_content({"type": "paragraph", "data": {"text": f'<img src="{self.file_url}">'}}),
			update_modified=False,
		)

	def _private_file(self, owner, lesson):
		frappe.set_user(owner)
		try:
			# Fixture setup, not the thing under test.
			# nosemgrep: lms-unjustified-ignore-permissions
			file = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": f"co-upload-{frappe.generate_hash(length=8)}.txt",
					"is_private": 1,
					"content": f"co-authored media {frappe.generate_hash(length=8)}",
					"attached_to_doctype": "Course Lesson",
					"attached_to_name": lesson,
					"attached_to_field": "content",
				}
			).insert(ignore_permissions=True)
		finally:
			frappe.set_user("Administrator")

		self.assertEqual(file.owner, owner)
		self.addCleanup(self._unlink, file.get_full_path())
		return file.file_url

	@staticmethod
	def _unlink(path):
		import os

		if os.path.exists(path):
			os.remove(path)

	def _drop_from_instructors(self, user):
		frappe.db.delete(
			"Course Instructor", {"parent": self.course, "parenttype": "LMS Course", "instructor": user}
		)
		frappe.set_user(user)
		try:
			self.assertFalse(can_modify_course(self.course), msg="fixture: the drop must have landed")
		finally:
			frappe.set_user("Administrator")

	def _serve_as(self, user):
		"""See TestServeResourceFileOwnership._serve_as."""
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

	def test_enrolled_learner_keeps_the_media_after_the_uploader_is_dropped(self):
		self._drop_from_instructors(self.uploader)
		self.assertEqual(self._serve_as(self.student), self.SERVED)

	def test_the_lesson_author_keeps_the_media_after_the_uploader_is_dropped(self):
		self._drop_from_instructors(self.uploader)
		self.assertEqual(self._serve_as(self.lesson_author), self.SERVED)

	def test_an_unenrolled_account_is_still_denied_after_the_drop(self):
		"""Control: the audience is still the lesson's, not everybody's."""
		self._drop_from_instructors(self.uploader)
		self.assertEqual(self._serve_as(self.outsider), self.DENIED)


class TestServeResourceOwnerLookupIsBatched(BaseTestUtils):
	"""Every File row sharing a url adds an owner that has to be judged, so the
	authorship and Moderator lookups must not run once per owner: a popular asset would
	put a query per row on every media request.

	The invariant is measured, not asserted against a magic number -- the same reference
	set with more distinct owners must cost the same number of queries.
	"""

	COUNTED_TABLES = ("tabCourse Instructor", "tabHas Role")

	def setUp(self):
		super().setUp()
		suffix = frappe.generate_hash(length=6)

		self.author = self._create_user(
			f"budget-author-{suffix}@example.com", "Budget", "Author", ["Course Creator"]
		).name
		self.course = self._create_course(title=f"Budget Course {suffix}", instructor=self.author).name
		chapter = self._create_chapter(f"Budget Chapter {suffix}", self.course).name
		self.lesson = self._create_lesson(f"Budget Lesson {suffix}", chapter, self.course).name
		frappe.db.set_value("Course Lesson", self.lesson, "owner", self.author, update_modified=False)

		self.file_url = self._private_file(self.author)

	def _private_file(self, owner):
		frappe.set_user(owner)
		try:
			# Fixture setup, not the thing under test.
			# nosemgrep: lms-unjustified-ignore-permissions
			file = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": f"budget-{frappe.generate_hash(length=8)}.txt",
					"is_private": 1,
					"content": f"budget media {frappe.generate_hash(length=8)}",
					"attached_to_doctype": "Course Lesson",
					"attached_to_name": self.lesson,
					"attached_to_field": "content",
				}
			).insert(ignore_permissions=True)
		finally:
			frappe.set_user("Administrator")
		self.addCleanup(self._unlink, file.get_full_path())
		return file.file_url

	@staticmethod
	def _unlink(path):
		import os

		if os.path.exists(path):
			os.remove(path)

	def _add_moderator_rows(self, count):
		"""`count` further File rows for the same url, each owned by a different Moderator.

		A Moderator's row is the one a non-uploader can still have weighed, so this grows
		the set of owners the vouching step must judge without changing its verdict.
		"""
		for _i in range(count):
			suffix = frappe.generate_hash(length=8)
			moderator = self._create_user(
				f"budget-mod-{suffix}@example.com", "Budget", "Moderator", ["Course Creator", "Moderator"]
			).name
			frappe.set_user(moderator)
			try:
				# nosemgrep: lms-unjustified-ignore-permissions
				file = frappe.get_doc(
					{
						"doctype": "File",
						"file_name": f"budget-extra-{suffix}.txt",
						"is_private": 1,
						"content": f"budget extra {suffix}",
						"attached_to_doctype": "Course Lesson",
						"attached_to_name": self.lesson,
						"attached_to_field": "content",
					}
				).insert(ignore_permissions=True)
			finally:
				frappe.set_user("Administrator")
			self.addCleanup(self._unlink, file.get_full_path())
			frappe.db.set_value("File", file.name, "file_url", self.file_url, update_modified=False)

	def _vouch_and_count(self):
		"""(vouched references, queries against the counted tables) for one resolution."""
		from lms.lms.doctype.course_lesson.course_lesson import (
			_references_vouched_by_owner,
			_resolve_lesson_references,
		)

		references = _resolve_lesson_references(self.file_url)

		counted = []
		real_sql = frappe.local.db.sql

		def counting_sql(query, *args, **kwargs):
			text = str(query)
			if any(table in text for table in self.COUNTED_TABLES):
				counted.append(text)
			return real_sql(query, *args, **kwargs)

		frappe.local.db.sql = counting_sql
		try:
			vouched = _references_vouched_by_owner(references)
		finally:
			frappe.local.db.sql = real_sql

		return vouched, len(counted)

	def test_the_owner_lookup_does_not_grow_with_the_number_of_owners(self):
		self._add_moderator_rows(1)
		few_vouched, few_queries = self._vouch_and_count()

		self._add_moderator_rows(4)
		many_vouched, many_queries = self._vouch_and_count()

		# Control: the extra owners must not change the verdict, only the cost.
		self.assertIn((self.lesson, False), few_vouched)
		self.assertIn((self.lesson, False), many_vouched)

		self.assertEqual(
			many_queries,
			few_queries,
			msg=f"owner lookups must be batched: {few_queries} query(s) for 2 owners, "
			f"{many_queries} for 6",
		)
