# Copyright (c) 2025, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import nowdate


class LMSCoupon(Document):
	def validate(self):
		if self.code:
			self.code = self.code.strip().upper()

		if not self.code:
			frappe.throw(_("Coupon code is required"))

		if len(self.code) < 6:
			frappe.throw(_("Coupon code must be atleast 6 characters"))

		if self.name:
			existing = frappe.db.exists(
				"LMS Coupon",
				{
					"code": self.code,
					"name": ["!=", self.name],
				},
			)
		else:
			existing = frappe.db.exists("LMS Coupon", {"code": self.code})

		if existing:
			frappe.throw(_("Coupon code is already taken. Use a different one"))

		if not self.discount_type:
			frappe.throw(_("Discount type is required"))

		if self.discount_type == "Percent":
			if not self.percent_off or self.percent_off == "":
				frappe.throw(_("Discount percentage is required"))
			try:
				percent_value = float(self.percent_off)
				if not (0 < percent_value <= 100):
					frappe.throw(_("Discount percentage must be between 1 and 100"))
			except (ValueError, TypeError):
				frappe.throw(_("Discount percentage must be a valid number"))
			self.amount_off = None

		if self.discount_type == "Amount":
			if not self.amount_off or self.amount_off == "":
				frappe.throw(_("Discount amount is required"))
			try:
				amount_value = float(self.amount_off)
				if amount_value < 0:
					frappe.throw(_("Discount amount cannot be negative"))
			except (ValueError, TypeError):
				frappe.throw(_("Discount amount must be a valid number"))
			self.percent_off = None

		if self.usage_limit is not None and self.usage_limit != "":
			try:
				usage_value = int(self.usage_limit)
				if usage_value < 0:
					frappe.throw(_("Usage limit cannot be negative"))
			except (ValueError, TypeError):
				frappe.throw(_("Usage limit must be a valid number"))

		if self.expires_on and str(self.expires_on) < nowdate():
			frappe.throw(_("Expiry date cannot be in the past"))

		if not self.get("applicable_items") or len(self.get("applicable_items")) == 0:
			frappe.throw(_("Please select atleast one course or batch"))

		for item in self.get("applicable_items"):
			if not item.get("reference_name"):
				frappe.throw(_("Please select a valid course or batch"))
