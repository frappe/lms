import frappe
import unittest
from datetime import date, timedelta
from lms.lms.doctype.lms_coupon.lms_coupon import LMSCoupon


class TestLMSCoupon(unittest.TestCase):
    def setUp(self):
        # Create test instructor first
        if not frappe.db.exists("User", "test@instructor.com"):
            instructor = frappe.get_doc({
                "doctype": "User",
                "email": "test@instructor.com",
                "first_name": "Test",
                "last_name": "Instructor",
                "send_welcome_email": 0
            }).insert(ignore_permissions=True)
        else:
            instructor = frappe.get_doc("User", "test@instructor.com")

        # Create test course with all mandatory fields
        self.course = frappe.get_doc({
            "doctype": "LMS Course",
            "title": "Test Course",
            "course_name": "test-course",
            "short_introduction": "This is a test course",
            "description": "A comprehensive test course for testing coupon functionality",
            "instructors": [
                {
                    "instructor": instructor.name
                }
            ]
        }).insert(ignore_permissions=True)

    def tearDown(self):
        # Clean up test data
        frappe.db.rollback()

    def test_percentage_discount_calculation(self):
        """Test percentage discount calculation"""
        coupon = frappe.get_doc({
            "doctype": "LMS Coupon",
            "coupon_code": "TEST10",
            "discount_type": "Percentage",
            "discount_value": 10,
            "course": self.course.name,
            "is_active": 1,
            "max_uses": 100
        }).insert(ignore_permissions=True)

        discount = coupon.calculate_discount(1000)
        self.assertEqual(discount, 100)  # 10% of 1000

    def test_fixed_amount_discount_calculation(self):
        """Test fixed amount discount calculation"""
        coupon = frappe.get_doc({
            "doctype": "LMS Coupon",
            "coupon_code": "FIXED50",
            "discount_type": "Fixed Amount",
            "discount_value": 50,
            "course": self.course.name,
            "is_active": 1,
            "max_uses": 100
        }).insert(ignore_permissions=True)

        # Test normal case
        discount = coupon.calculate_discount(1000)
        self.assertEqual(discount, 50)

        # Test when discount is more than amount
        discount = coupon.calculate_discount(30)
        self.assertEqual(discount, 30)  # Should not exceed amount

    def test_coupon_validity_dates(self):
        """Test coupon validity date checks"""
        # Future coupon
        future_coupon = frappe.get_doc({
            "doctype": "LMS Coupon",
            "coupon_code": "FUTURE",
            "discount_type": "Percentage",
            "discount_value": 10,
            "course": self.course.name,
            "is_active": 1,
            "valid_from": date.today() + timedelta(days=1),
            "max_uses": 100
        }).insert(ignore_permissions=True)

        can_use, message = future_coupon.can_use_coupon()
        self.assertFalse(can_use)
        self.assertIn("not yet valid", message)

        # Expired coupon
        expired_coupon = frappe.get_doc({
            "doctype": "LMS Coupon",
            "coupon_code": "EXPIRED",
            "discount_type": "Percentage",
            "discount_value": 10,
            "course": self.course.name,
            "is_active": 1,
            "valid_till": date.today() - timedelta(days=1),
            "max_uses": 100
        }).insert(ignore_permissions=True)

        can_use, message = expired_coupon.can_use_coupon()
        self.assertFalse(can_use)
        self.assertIn("expired", message)

    def test_coupon_usage_limit(self):
        """Test coupon usage limit"""
        coupon = frappe.get_doc({
            "doctype": "LMS Coupon",
            "coupon_code": "LIMITED",
            "discount_type": "Percentage",
            "discount_value": 10,
            "course": self.course.name,
            "is_active": 1,
            "max_uses": 2,
            "used_count": 2
        }).insert(ignore_permissions=True)

        can_use, message = coupon.can_use_coupon()
        self.assertFalse(can_use)
        self.assertIn("usage limit exceeded", message)

    def test_increment_usage(self):
        """Test usage increment"""
        coupon = frappe.get_doc({
            "doctype": "LMS Coupon",
            "coupon_code": "INCREMENT",
            "discount_type": "Percentage",
            "discount_value": 10,
            "course": self.course.name,
            "is_active": 1,
            "max_uses": 100,
            "used_count": 0
        }).insert(ignore_permissions=True)

        initial_count = coupon.used_count
        coupon.increment_usage()
        
        # Reload to check updated value
        coupon.reload()
        self.assertEqual(coupon.used_count, initial_count + 1)