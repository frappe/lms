import frappe
from frappe.model.document import Document
from datetime import date


class LMSCoupon(Document):
    def validate(self):
        self.validate_applicable_fields()
        self.validate_discount_value()

    def validate_applicable_fields(self):
        """Ensure either course or batch is selected based on applicable_to"""
        if self.applicable_to == "Course":
            if not self.course:
                frappe.throw("Course is required when Applicable To is Course")
            self.batch = None  
        elif self.applicable_to == "Batch":
            if not self.batch:
                frappe.throw("Batch is required when Applicable To is Batch")
            self.course = None  

    def validate_discount_value(self):
        """Validate discount value based on type"""
        if self.discount_type == "Percentage" and (self.discount_value < 0 or self.discount_value > 100):
            frappe.throw("Percentage discount must be between 0 and 100")
        elif self.discount_type == "Fixed Amount" and self.discount_value < 0:
            frappe.throw("Fixed amount discount cannot be negative")

    def can_use_coupon(self):
        """Check if coupon can be used"""
        if not self.is_active:
            return False, "Coupon is not active"

        today = date.today()
        if self.valid_from and today < self.valid_from:
            return False, "Coupon is not yet valid"
        if self.valid_till and today > self.valid_till:
            return False, "Coupon has expired"

        if self.max_uses > 0 and self.used_count >= self.max_uses:
            return False, "Coupon usage limit exceeded"

        return True, "Coupon is valid"

    def calculate_discount(self, amount):
        """Calculate discount amount"""
        if self.discount_type == "Percentage":
            return min(amount * (self.discount_value / 100), amount)
        else: 
            return min(self.discount_value, amount)

    def increment_usage(self):
        """Increment usage count"""
        self.used_count = (self.used_count or 0) + 1
        self.save(ignore_permissions=True)

    def get_applicable_reference(self):
        """Get the reference document (course or batch)"""
        if self.applicable_to == "Course":
            return self.course
        elif self.applicable_to == "Batch":
            return self.batch
        return None