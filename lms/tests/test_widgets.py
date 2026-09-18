# Copyright (c) 2021, FOSS United and Contributors
# See license.txt
import unittest

from lms.widgets import Widgets


class TestWidgets(unittest.TestCase):
	def test_Widgets(self):
		widgets = Widgets()
		assert widgets.Foo.name == "Foo"
		assert widgets.Bar.name == "Bar"
