# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase


class TestSidebarItemSchema(IntegrationTestCase):
	def test_the_row_carries_the_fields_the_sidebar_page_writes(self):
		meta = frappe.get_meta("LMS Sidebar Item")
		for fieldname in (
			"name1",
			"is_standard",
			"item_type",
			"hidden",
			"url",
			"open_in_new_window",
		):
			self.assertTrue(meta.has_field(fieldname), f"missing field: {fieldname}")

	def test_a_row_with_no_web_page_and_no_icon_is_allowed(self):
		meta = frappe.get_meta("LMS Sidebar Item")
		self.assertFalse(meta.get_field("web_page").reqd)
		self.assertFalse(meta.get_field("icon").reqd)
		self.assertFalse(meta.get_field("icon").read_only)

	def test_item_type_offers_every_kind_of_row(self):
		options = frappe.get_meta("LMS Sidebar Item").get_field("item_type").options
		self.assertEqual(
			options.split("\n"),
			["Built-in", "Web Page", "Route", "External"],
		)
