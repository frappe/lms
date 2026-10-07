import unittest
from unittest.mock import patch

from frappe.search.sqlite_search import SQLiteSearch

from lms.sqlite import LearningSearch


class TestLearningSearchIndex(unittest.TestCase):
	def test_forwards_resumable_index_arguments(self):
		search = object.__new__(LearningSearch)
		with patch.object(SQLiteSearch, "build_index") as build_index:
			search.build_index(batch_size=25, is_continuation=True)
			build_index.assert_called_once_with(batch_size=25, is_continuation=True)

	def test_preserves_default_index_build(self):
		search = object.__new__(LearningSearch)
		with patch.object(SQLiteSearch, "build_index") as build_index:
			search.build_index()
			build_index.assert_called_once_with()
