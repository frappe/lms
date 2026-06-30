# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import unittest

import frappe

from lms.lms.course_import_export import (
	get_assessments_from_lesson,
	replace_assessment_names,
	replace_assets,
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

	def test_replace_assets_non_json_is_noop(self):
		# replace_assets returns None and touches nothing for unparseable content.
		self.assertIsNone(replace_assets(RAW_URL))
		self.assertIsNone(replace_assets("[1, 2]"))
