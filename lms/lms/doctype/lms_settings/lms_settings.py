# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class LMSSettings(Document):

	pages = [
		{"label": "Explore", "idx": 1},
		{"label": "Courses", "url": "/courses", "parent": "Explore", "idx": 2},
		{"label": "Classes", "url": "/classes", "parent": "Explore", "idx": 3},
		{"label": "Statistics", "url": "/statistics", "parent": "Explore", "idx": 4},
		{"label": "Jobs", "url": "/jobs", "parent": "Explore", "idx": 5},
		{"label": "People", "url": "/community", "parent": "Explore", "idx": 6},
	]

	def on_update(self):
		self.update_navbar()

	def update_navbar(self):
		for page in self.pages:
			filters = frappe._dict()
			if page.get("url"):
				filters["url"] = ["like", "%" + page.get("url") + "%"]
			else:
				filters["label"] = page.get("label")

			if self.add_to_navbar and not frappe.db.exists("Top Bar Item", filters):
				frappe.get_doc(
					{
						"doctype": "Top Bar Item",
						"label": page.get("label"),
						"url": page.get("url"),
						"parent_label": page.get("parent"),
						"idx": page.get("idx"),
						"parent": "Website Settings",
						"parenttype": "Website Settings",
						"parentfield": "top_bar_items",
					}
				).save()
			elif not self.add_to_navbar and frappe.db.exists("Top Bar Item", filters):
				frappe.db.delete("Top Bar Item", filters)
