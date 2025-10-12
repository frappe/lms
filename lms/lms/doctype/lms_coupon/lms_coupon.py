# Copyright (c) 2025, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import nowdate


class LMSCoupon(Document):
    def validate(self):
        # Normalize code to uppercase and strip spaces
        if self.code:
            self.code = self.code.strip().upper()

        if not self.code:
            frappe.throw(_("Coupon code is required."))

        # Ensure uniqueness of code (case-insensitive)
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
            frappe.throw(_("Coupon code already exists."))

        if not self.discount_type:
            frappe.throw(_("Discount type is required."))

        if self.discount_type == "Percent":
            if self.percent_off is None:
                frappe.throw(_("Percent Off is required for Percent discount type."))
            if not (0 < float(self.percent_off) <= 100):
                frappe.throw(_("Percent Off must be between 1 and 100."))
            # Clear the other field to avoid confusion
            self.amount_off = None

        if self.discount_type == "Amount":
            if self.amount_off is None:
                frappe.throw(_("Amount Off is required for Amount discount type."))
            if float(self.amount_off) < 0:
                frappe.throw(_("Amount Off cannot be negative."))
            # Clear the other field
            self.percent_off = None

        if self.usage_limit is not None and int(self.usage_limit) < 0:
            frappe.throw(_("Usage limit cannot be negative."))

        if self.expires_on and str(self.expires_on) < nowdate():
            frappe.throw(_("Expiry date cannot be in the past."))
