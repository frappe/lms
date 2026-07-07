# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import json
import unittest

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

	def test_quiz_off_returns_true_for_quiz(self):
		self.assertEqual(
			self._call(quiz_done=False, assignment_done=False, enforce_quiz=0, enforce_assignment=1),
			(True, False),
		)

	def test_assignment_off_returns_true_for_assignment(self):
		self.assertEqual(
			self._call(quiz_done=False, assignment_done=False, enforce_quiz=1, enforce_assignment=0),
			(False, True),
		)

	def test_both_off_returns_true_true(self):
		self.assertEqual(
			self._call(quiz_done=False, assignment_done=False, enforce_quiz=0, enforce_assignment=0),
			(True, True),
		)

	def test_missing_settings_keys_treated_as_enforced(self):
		from lms.lms.doctype.course_lesson.course_lesson import (
			apply_enforcement_flags,
		)

		self.assertEqual(
			apply_enforcement_flags(quiz_done=False, assignment_done=True, settings={}),
			(False, True),
		)


class TestApplyEnforcementFlagsEdgeCases(unittest.TestCase):
	def setUp(self):
		from lms.lms.doctype.course_lesson.course_lesson import (
			apply_enforcement_flags,
		)

		self.fn = apply_enforcement_flags

	def test_dict_subclass_input(self):
		"""A frappe._dict-like subclass of dict should work via duck-typing."""

		class _Dict(dict):
			pass

		settings = _Dict({"enforce_quiz_completion": 0, "enforce_assignment_completion": 1})
		self.assertEqual(self.fn(quiz_done=False, assignment_done=False, settings=settings), (True, False))

	def test_string_zero_is_truthy_treated_as_enforced(self):
		"""Frappe may return '0' as a string from raw queries. `not '0'` is False, so it's still enforced.

		Codifies current behavior — callers that hit this should pass int(value) explicitly.
		"""
		settings = {"enforce_quiz_completion": "0", "enforce_assignment_completion": "0"}
		# Both still treated as enforced because non-empty strings are truthy.
		self.assertEqual(self.fn(quiz_done=False, assignment_done=False, settings=settings), (False, False))

	def test_string_one_treated_as_enforced(self):
		settings = {"enforce_quiz_completion": "1", "enforce_assignment_completion": "1"}
		self.assertEqual(self.fn(quiz_done=True, assignment_done=True, settings=settings), (True, True))
		self.assertEqual(self.fn(quiz_done=False, assignment_done=True, settings=settings), (False, True))

	def test_none_for_flag_disables_enforcement(self):
		"""Present-but-None: helper sees `not None == True`, treats as NOT enforced.

		Distinct from missing key (which defaults to 1 / enforced via dict.get's default).
		"""
		settings = {"enforce_quiz_completion": None, "enforce_assignment_completion": 1}
		self.assertEqual(self.fn(quiz_done=False, assignment_done=False, settings=settings), (True, False))

	def test_both_int_zero_disabled(self):
		settings = {"enforce_quiz_completion": 0, "enforce_assignment_completion": 0}
		for quiz_done in (True, False):
			for assignment_done in (True, False):
				with self.subTest(quiz_done=quiz_done, assignment_done=assignment_done):
					self.assertEqual(
						self.fn(quiz_done=quiz_done, assignment_done=assignment_done, settings=settings),
						(True, True),
					)

	def test_idempotent(self):
		settings = {"enforce_quiz_completion": 1, "enforce_assignment_completion": 1}
		first = self.fn(quiz_done=True, assignment_done=False, settings=settings)
		second = self.fn(quiz_done=True, assignment_done=False, settings=settings)
		self.assertEqual(first, second)

	def test_does_not_mutate_settings(self):
		settings = {"enforce_quiz_completion": 1, "enforce_assignment_completion": 0}
		snapshot = dict(settings)
		self.fn(quiz_done=True, assignment_done=False, settings=settings)
		self.assertEqual(settings, snapshot)

	def test_keyword_argument_contract(self):
		"""save_progress invokes with keyword args; the helper must accept them in any order."""
		settings = {"enforce_quiz_completion": 1, "enforce_assignment_completion": 1}
		self.assertEqual(
			self.fn(settings=settings, quiz_done=True, assignment_done=False),
			(True, False),
		)
		self.assertEqual(
			self.fn(assignment_done=False, quiz_done=True, settings=settings),
			(True, False),
		)


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
	500'd when `content` wasn't EditorJS JSON — e.g. a raw video URL pasted into the Desk
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
	blocks surface a quiz/assignment id and, crucially, that embeds surface neither — so a
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
