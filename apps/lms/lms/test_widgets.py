# Copyright (c) 2021, FOSS United and Contributors
# See license.txt
import unittest

import frappe

from .widgets import Widget, Widgets


class TestWidgets(unittest.TestCase):
	def test_Widgets(self):
		widgets = Widgets()
		assert widgets.Foo.name == "Foo"
		assert widgets.Bar.name == "Bar"

	def _test_Widget(self):
		hello = Widget("HelloWorld")
		assert hello(name="Test") == "Hello, Test"
