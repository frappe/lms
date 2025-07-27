# lms/lms/doctype/lms_coupon/lms_coupon.py
import frappe
from frappe.model.document import Document
from frappe import _


class LMSCoupon(Document):
	def validate(self):
		self.validate_dates()
		self.validate_discount_value()

	def validate_dates(self):
		if self.valid_from and self.valid_till:
			if self.valid_from > self.valid_till:
				frappe.throw(_("Valid From date cannot be after Valid Till date"))

	def validate_discount_value(self):
		if self.discount_value <= 0:
			frappe.throw(_("Discount Value must be greater than 0"))

		if self.discount_type == "Percentage" and self.discount_value > 100:
			frappe.throw(_("Percentage discount cannot be more than 100%"))

	def can_use_coupon(self, user_email=None):
		"""Check if coupon can be used"""
		if not self.is_active:
			return False, _("Coupon is not active")

		# Check validity dates
		from datetime import date

		today = date.today()

		if self.valid_from and today < self.valid_from:
			return False, _("Coupon is not yet valid")

		if self.valid_till and today > self.valid_till:
			return False, _("Coupon has expired")

		# Check usage limit
		if self.max_uses > 0 and self.used_count >= self.max_uses:
			return False, _("Coupon usage limit exceeded")

		return True, ""

	def calculate_discount(self, amount):
		"""Calculate discount amount based on coupon type"""
		if self.discount_type == "Percentage":
			discount_amount = (amount * self.discount_value) / 100
		else:  # Fixed Amount
			discount_amount = min(
				self.discount_value, amount
			)  # Can't discount more than the amount

		return discount_amount

	def increment_usage(self):
		"""Increment the usage count"""
		frappe.db.set_value("LMS Coupon", self.name, "used_count", self.used_count + 1)
