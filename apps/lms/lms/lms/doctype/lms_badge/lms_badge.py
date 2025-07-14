# Copyright (c) 2024, Frappe and contributors
# For license information, please see license.txt

import frappe
import json
from frappe.model.document import Document
from frappe import _


class LMSBadge(Document):
	def on_update(self):
		if self.event == "Auto Assign" and self.condition:
			try:
				json.loads(self.condition)
			except ValueError:
				frappe.throw(_("Condition must be in valid JSON format."))
		elif self.condition:
			try:
				compile(self.condition, "<string>", "eval")
			except Exception:
				frappe.throw(_("Condition must be valid python code."))

	def apply(self, doc):
		if self.rule_condition_satisfied(doc):
			award(self, doc.get(self.user_field))

	def rule_condition_satisfied(self, doc):
		doc_before_save = doc.get_doc_before_save()

		if self.event == "Manual Assignment":
			return False

		if self.event == "New" and doc_before_save != None:
			return False

		if self.event == "Value Change":
			field_to_check = self.field_to_check
			if not field_to_check:
				return False

		if self.condition:
			return eval_condition(doc, self.condition)

		return False


def award(doc, member):
	if doc.grant_only_once:
		if frappe.db.exists(
			"LMS Badge Assignment",
			{"badge": doc.name, "member": member},
		):
			return

	assignment = frappe.new_doc("LMS Badge Assignment")
	assignment.update(
		{
			"badge": doc.name,
			"member": member,
			"issued_on": frappe.utils.now(),
		}
	)
	assignment.save()


def eval_condition(doc, condition):
	return condition and frappe.safe_eval(condition, None, {"doc": doc.as_dict()})


@frappe.whitelist()
def assign_badge(badge):
	badge = frappe._dict(json.loads(badge))
	if not badge.event == "Auto Assign":
		return

	fields = ["name"]
	fields.append(badge.user_field)
	list = frappe.get_all(badge.reference_doctype, filters=badge.condition, fields=fields)
	for doc in list:
		award(badge, doc.get(badge.user_field))


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
