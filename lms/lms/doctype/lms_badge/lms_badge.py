# Copyright (c) 2024, Frappe and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import _
from frappe.model.document import Document


class LMSBadge(Document):
	def on_update(self):
		if self.event == "Manual Assignment" and self.condition:
			try:
				json.loads(self.condition)
			except ValueError:
				frappe.throw(_("Condition must be in valid JSON format."))
		elif self.condition:
			# Syntax check only: the code object is discarded, and the condition runs
			# through frappe.safe_eval. ast.parse would be looser than the compiler.
			try:
				compile(self.condition, "<string>", "eval")  # nosemgrep
			except Exception:
				frappe.throw(_("Condition must be valid python code."))

		self.clear_badge_map()

	def on_trash(self):
		self.clear_badge_map()

	def clear_badge_map(self):
		doctypes = {self.reference_doctype}
		if before := self.get_doc_before_save():
			doctypes.add(before.reference_doctype)
		for doctype in doctypes:
			frappe.cache_manager.clear_doctype_map("LMS Badge", doctype)

	def apply(self, doc):
		member = doc.get(self.user_field)
		if member and self.rule_condition_satisfied(doc):
			award(self, member)

	def rule_condition_satisfied(self, doc):
		if self.event == "Manual Assignment" or not self.condition:
			return False

		doc_before_save = doc.get_doc_before_save()
		if self.event == "New" and doc_before_save is not None:
			return False

		if not eval_condition(doc, self.condition):
			return False

		if self.event == "Value Change" and doc_before_save is not None:
			return not eval_condition(doc_before_save, self.condition)

		return True


def award(doc, member):
	if doc.grant_only_once or doc.event == "Value Change":
		frappe.db.get_value("LMS Badge", doc.name, "name", for_update=True)
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
	# nosemgrep: lms-unjustified-ignore-permissions - award() is not reachable directly by a user
	assignment.save(ignore_permissions=True)
	return assignment.name


def eval_condition(doc, condition):
	return condition and frappe.safe_eval(condition, None, {"doc": doc.as_dict()})


@frappe.whitelist(methods=["POST"])
def assign_badge(badge_name: str):
	frappe.only_for(["Moderator", "Course Creator", "Batch Evaluator"])
	assignments = []
	badge = frappe.db.get_value(
		"LMS Badge",
		badge_name,
		["name", "event", "reference_doctype", "condition", "user_field"],
		as_dict=True,
	)
	if not badge:
		frappe.throw(_("Badge {0} not found").format(badge_name), frappe.DoesNotExistError)

	if not badge.event == "Manual Assignment":
		return

	fields = ["name"]
	fields.append(badge.user_field)
	docs = frappe.get_all(badge.reference_doctype, filters=json.loads(badge.condition), fields=fields)

	for doc in docs:
		assignment_name = award(badge, doc.get(badge.user_field))
		if assignment_name:
			assignments.append(assignment_name)

	return "success" if assignments else "failed"


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
		apply_badge(d.get("name"), doc)


def apply_badge(badge_name, doc):
	"""Award one badge for `doc` without letting a badge error fail the save of `doc`."""
	savepoint = f"lms_badge_{frappe.generate_hash(length=10)}"
	messages = len(frappe.local.message_log)
	frappe.db.savepoint(savepoint)
	try:
		badge = frappe.get_doc("LMS Badge", badge_name)
		if badge.enabled:
			badge.apply(doc)
	except Exception:
		frappe.db.rollback(save_point=savepoint)
		del frappe.local.message_log[messages:]
		frappe.log_error(
			title=f"Could not award badge {badge_name} for {doc.doctype} {doc.name}",
			reference_doctype=doc.doctype,
			reference_name=doc.name,
		)
	else:
		frappe.db.release_savepoint(savepoint)
