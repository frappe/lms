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
			"web_page",
			"icon",
		):
			self.assertTrue(meta.has_field(fieldname), f"missing field: {fieldname}")
