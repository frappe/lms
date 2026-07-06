# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import unittest

import frappe

from lms.lms.course_import_export import (
	get_assessments_from_lesson,
	replace_assessment_names,
)

RAW_URL = "https://www.youtube.com/watch?v=htpg8CuD1Ec"


class TestImportExportContentGuards(unittest.TestCase):
	"""Course export/import reads each lesson's EditorJS content. A lesson with
	non-JSON content (e.g. a raw URL pasted into the Desk form) used to 500 the
	whole export. These readers must fail soft. Fixture-free: the non-JSON paths
	never reach the DB.
	"""

	def test_get_assessments_from_lesson_non_json(self):
		# Non-JSON content yields no assessments/questions/test_cases and never hits the DB.
		self.assertEqual(get_assessments_from_lesson(frappe._dict(content=RAW_URL)), ([], [], []))
		self.assertEqual(get_assessments_from_lesson(frappe._dict(content=None)), ([], [], []))

	def test_replace_assessment_names_passes_non_json_through(self):
		# Mutate-and-redump path: unparseable content is returned unchanged, not crashed.
		self.assertEqual(replace_assessment_names(None, RAW_URL), RAW_URL)

	def test_replace_assessment_names_handles_non_object_json(self):
		# Valid JSON that isn't an EditorJS envelope must not raise either.
		self.assertEqual(replace_assessment_names(None, "[1, 2]"), "[1, 2]")

	def test_replace_assessment_names_skips_malformed_blocks(self):
		# Valid EditorJS envelope but the blocks are shaped wrong: a non-dict block, and
		# blocks whose `data` is a truthy non-dict / null. This mutate-and-redump path
		# iterates raw blocks (not via get_editorjs_blocks), so it must skip them itself
		# rather than AttributeError on block.get("data", {}).get(...). No DB is reached
		# because no assessment name is extracted.
		content = frappe.as_json(
			{
				"blocks": [
					"a string",
					{"type": "quiz", "data": "x"},
					{"type": "quiz", "data": None},
					{"type": "paragraph", "data": {"text": "ok"}},
				]
			}
		)
		# Round-trips without raising; the well-formed paragraph is preserved.
		result = replace_assessment_names(None, content)
		self.assertIn("paragraph", result)
