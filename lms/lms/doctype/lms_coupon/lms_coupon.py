import frappe
from frappe.utils import today
from frappe.model.document import Document


class LMSCoupon(Document):
	def validate(self):
		self.validate_applicable_fields()
		self.validate_discount_value()

	def validate_applicable_fields(self):
		if not self.applicable_reference:
			frappe.throw(frappe._("Course/Batch is required"))


	def validate_discount_value(self):
		if self.discount_type == "Percentage" and (
			self.discount_value < 0 or self.discount_value > 100
		):
			frappe.throw(frappe._("Percentage discount must be between 0 and 100"))
		elif self.discount_type == "Fixed Amount" and self.discount_value < 0:
			frappe.throw(frappe._("Fixed amount discount cannot be negative"))

	def can_use_coupon(self):
		if not self.is_active:
			return False, frappe._("Coupon is not active")

		current_date = today()
		if self.valid_from and current_date < self.valid_from:
			return False, frappe._("Coupon is not yet valid")
		if self.valid_till and current_date > self.valid_till:
			return False, frappe._("Coupon has expired")

		if self.max_uses > 0 and self.used_count >= self.max_uses:
			return False, frappe._("Coupon usage limit exceeded")

		return True, frappe._("Coupon is valid")

	def calculate_discount(self, reference_doctype, reference_docname):
		if not reference_doctype or not reference_docname:
			return 0
		
		if reference_doctype not in ["LMS Course", "LMS Batch"]:
			frappe.throw(frappe._("Invalid reference doctype. Only LMS Course and LMS Batch are supported."))
		
		if self.applicable_to != reference_doctype:
			frappe.throw(frappe._(
				"This coupon is for {0} but you are trying to apply it to {1}".format(
					self.applicable_to, reference_doctype
				)
			))
		
		if self.applicable_reference != reference_docname:
			frappe.throw(frappe._(
				"This coupon is only applicable to {0}: {1}".format(
					reference_doctype, self.applicable_reference
				)
			))
		
		can_use, message = self.can_use_coupon()
		if not can_use:
			frappe.throw(message)
		
		amount = 0
		if reference_doctype == "LMS Course":
			amount = frappe.db.get_value("LMS Course", reference_docname, "course_price") or 0
		elif reference_doctype == "LMS Batch":
			amount = frappe.db.get_value("LMS Batch", reference_docname, "amount") or 0
		
		if amount <= 0:
			frappe.throw(frappe._("Cannot apply coupon: {0} has no price set".format(reference_doctype)))
		
		if self.discount_type == "Percentage":
			discount = amount * (self.discount_value / 100)
		else:  
			discount = self.discount_value
		
		return min(discount, amount)

	def increment_usage(self):
		self.used_count = (self.used_count or 0) + 1
		self.save(ignore_permissions=True)

	def get_applicable_reference(self):
		return self.applicable_reference
