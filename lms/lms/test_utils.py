import unittest

import frappe
from .utils import slugify


class TestUtils(unittest.TestCase):
	def test_simple(self):
		self.assertEqual(slugify("hello-world"), "hello-world")
		self.assertEqual(slugify("Hello World"), "hello-world")
		self.assertEqual(slugify("Hello, World!"), "hello-world")

	def test_duplicates(self):
		self.assertEqual(slugify("Hello World", ["hello-world"]), "hello-world-2")

		self.assertEqual(
			slugify("Hello World", ["hello-world", "hello-world-2"]), "hello-world-3"
		)
