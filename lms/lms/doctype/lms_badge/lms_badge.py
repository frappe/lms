# Copyright (c) 2024, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class LMSBadge(Document):
	def apply(self, doc):
		if self.rule_condition_satisfied(doc):
			print("rule satisfied")
			self.award(doc)

	def rule_condition_satisfied(self, doc):
		doc_before_save = doc.get_doc_before_save()
		if self.event == "New" and doc_before_save != None:
			return False
		print("its new")
		if self.event == "Value Change":
			field_to_check = self.field_to_check
			if not self.field_to_check:
				return False
			if doc_before_save and doc_before_save.get(field_to_check) == doc.get(
				field_to_check
			):
				return False

		if self.condition:
			print("found condition")
			print(self.eval_condition(doc))
			return self.eval_condition(doc)

		return False

	def award(self, doc):
		if self.grant_only_once:
			if frappe.db.exists(
				"LMS Badge Assignment",
				{"badge": self.name, "user": frappe.session.user},
			):
				return

		assignment = frappe.new_doc("LMS Badge Assignment")
		assignment.update(
			{
				"badge": self.name,
				"user": frappe.session.user,
				"issued_on": frappe.utils.now(),
			}
		)
		assignment.save()

	def eval_condition(self, doc):
		return self.condition and frappe.safe_eval(
			self.condition, None, {"doc": doc.as_dict()}
		)


def process_badges(doc, state):
	if (
		frappe.flags.in_patch
		or frappe.flags.in_install
		or frappe.flags.in_migrate
		or frappe.flags.in_import
		or frappe.flags.in_setup_wizard
	):
		return

	for d in frappe.cache_manager.get_doctype_map(
		"LMS Badge", doc.doctype, dict(reference_doctype=doc.doctype, enabled=1)
	):
		frappe.get_doc("LMS Badge", d.get("name")).apply(doc)
