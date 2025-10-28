# Copyright (c) 2025, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, nowdate


class LMSCoupon(Document):
	def validate(self):
		self.convert_to_uppercase()
		self.validate_expiry_date()
		self.validate_applicable_items()
		self.validate_usage_limit()

	def convert_to_uppercase(self):
		if self.code:
			self.code = self.code.strip().upper()

	def validate_expiry_date(self):
		if self.expires_on and str(self.expires_on) < nowdate():
			frappe.throw(_("Expiry date cannot be in the past"))

	def validate_applicable_items(self):
		if not self.get("applicable_items") or len(self.get("applicable_items")) == 0:
			frappe.throw(_("At least one applicable item is required"))

	def validate_usage_limit(self):
		if self.usage_limit is not None and cint(self.usage_limit) < 0:
			frappe.throw(_("Usage limit cannot be negative"))
