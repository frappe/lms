# Copyright (c) 2024, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from lms.lms.doctype.lms_badge.lms_badge import eval_condition


class LMSBadgeAssignment(Document):
	def validate(self):
		self.validate_duplicate_badge_assignment()
		self.validate_badge_criteria()
		self.validate_owner()

	def validate_owner(self):
		event = frappe.db.get_value("LMS Badge", self.badge, "event")
		if event == "Manual Assignment":
			roles = frappe.get_roles(frappe.session.user)
			admins = ["Moderator", "Course Creator", "Batch Evaluator"]
			if not any(role in roles for role in admins):
				frappe.throw(_("You must be an Admin to assign badges to users."))

	def validate_duplicate_badge_assignment(self):
		grant_only_once = frappe.db.get_value("LMS Badge", self.badge, "grant_only_once")
		if not grant_only_once:
			return

		if frappe.db.exists(
			"LMS Badge Assignment",
			{"badge": self.badge, "member": self.member, "name": ["!=", self.name]},
		):
			frappe.throw(
				_("Badge {0} has already been assigned to this {1}.").format(self.badge, self.member)
			)

	def validate_badge_criteria(self):
		badge_details = frappe.db.get_value(
			"LMS Badge", self.badge, ["reference_doctype", "user_field", "condition", "enabled"], as_dict=True
		)

		if not badge_details:
			return

		if badge_details.reference_doctype and badge_details.user_field and badge_details.condition:
			user_fieldname = frappe.db.get_value(
				"DocField",
				{"parent": badge_details.reference_doctype, "fieldname": badge_details.user_field},
				"fieldname",
			)

			documents = frappe.get_all(
				badge_details.reference_doctype,
				{user_fieldname: self.member},
			)

			for document in documents:
				reference_value = eval_condition(
					frappe.get_doc(badge_details.reference_doctype, document.name),
					badge_details.condition,
				)
				if reference_value:
					return

			frappe.throw(_("Member does not meet the criteria for the badge {0}.").format(self.badge))
