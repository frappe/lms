import frappe
import unittest
from datetime import date, timedelta


class TestLMSCoupon(unittest.TestCase):
	def setUp(self):
		if not frappe.db.exists("User", "test@instructor.com"):
			instructor = frappe.get_doc(
				{
					"doctype": "User",
					"email": "test@instructor.com",
					"first_name": "Test",
					"last_name": "Instructor",
					"send_welcome_email": 0,
				}
			).insert(ignore_permissions=True)
		else:
			instructor = frappe.get_doc("User", "test@instructor.com")

		self.course = frappe.get_doc(
			{
				"doctype": "LMS Course",
				"title": "Test Course",
				"course_name": "test-course",
				"short_introduction": "This is a test course",
				"description": "A comprehensive test course for testing coupon functionality",
				"instructors": [{"instructor": instructor.name}],
			}
		).insert(ignore_permissions=True)

		self.batch = frappe.get_doc(
			{
				"doctype": "LMS Batch",
				"title": "Test Batch",
				"description": "Test batch for coupon testing",
				"start_date": date.today(),
				"end_date": date.today() + timedelta(days=30),
				"start_time": "09:00:00",
				"end_time": "17:00:00",
				"timezone": "Asia/Kolkata",
				"batch_details": "<p>Test batch details for coupon testing</p>",
				"instructors": [{"instructor": instructor.name}],
				"courses": [{"course": self.course.name}],
			}
		).insert(ignore_permissions=True)

	def tearDown(self):
		frappe.db.rollback()

	def test_course_coupon_validation(self):
		"""Test coupon validation for courses"""
		coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "COURSE10",
				"applicable_to": "Course",
				"course": self.course.name,
				"discount_type": "Percentage",
				"discount_value": 10,
				"is_active": 1,
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		self.assertEqual(coupon.applicable_to, "Course")
		self.assertEqual(coupon.course, self.course.name)
		self.assertIsNone(coupon.batch)

	def test_batch_coupon_validation(self):
		"""Test coupon validation for batches"""
		coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "BATCH20",
				"applicable_to": "Batch",
				"batch": self.batch.name,
				"discount_type": "Percentage",
				"discount_value": 20,
				"is_active": 1,
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		self.assertEqual(coupon.applicable_to, "Batch")
		self.assertEqual(coupon.batch, self.batch.name)
		self.assertIsNone(coupon.course)

	def test_applicable_to_validation_error(self):
		"""Test validation errors for applicable_to field"""
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{
					"doctype": "LMS Coupon",
					"coupon_code": "INVALID1",
					"applicable_to": "Course",
					"discount_type": "Percentage",
					"discount_value": 10,
					"is_active": 1,
				}
			).insert(ignore_permissions=True)

		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{
					"doctype": "LMS Coupon",
					"coupon_code": "INVALID2",
					"applicable_to": "Batch",
					"discount_type": "Percentage",
					"discount_value": 10,
					"is_active": 1,
				}
			).insert(ignore_permissions=True)

	def test_get_applicable_reference(self):
		"""Test getting applicable reference"""
		course_coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "COURSEREF",
				"applicable_to": "Course",
				"course": self.course.name,
				"discount_type": "Percentage",
				"discount_value": 10,
				"is_active": 1,
			}
		).insert(ignore_permissions=True)

		self.assertEqual(course_coupon.get_applicable_reference(), self.course.name)

		batch_coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "BATCHREF",
				"applicable_to": "Batch",
				"batch": self.batch.name,
				"discount_type": "Percentage",
				"discount_value": 15,
				"is_active": 1,
			}
		).insert(ignore_permissions=True)

		self.assertEqual(batch_coupon.get_applicable_reference(), self.batch.name)

	def test_percentage_discount_calculation(self):
		"""Test percentage discount calculation"""
		coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "TEST10",
				"applicable_to": "Course",
				"discount_type": "Percentage",
				"discount_value": 10,
				"course": self.course.name,
				"is_active": 1,
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		discount = coupon.calculate_discount(1000)
		self.assertEqual(discount, 100)

	def test_fixed_amount_discount_calculation(self):
		"""Test fixed amount discount calculation"""
		coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "FIXED50",
				"applicable_to": "Course",
				"discount_type": "Fixed Amount",
				"discount_value": 50,
				"course": self.course.name,
				"is_active": 1,
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		discount = coupon.calculate_discount(1000)
		self.assertEqual(discount, 50)

		discount = coupon.calculate_discount(30)
		self.assertEqual(discount, 30)

	def test_coupon_validity_dates(self):
		"""Test coupon validity date checks"""
		future_coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "FUTURE",
				"applicable_to": "Course",
				"discount_type": "Percentage",
				"discount_value": 10,
				"course": self.course.name,
				"is_active": 1,
				"valid_from": date.today() + timedelta(days=1),
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		can_use, message = future_coupon.can_use_coupon()
		self.assertFalse(can_use)
		self.assertIn("not yet valid", message)

		expired_coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "EXPIRED",
				"applicable_to": "Course",
				"discount_type": "Percentage",
				"discount_value": 10,
				"course": self.course.name,
				"is_active": 1,
				"valid_till": date.today() - timedelta(days=1),
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		can_use, message = expired_coupon.can_use_coupon()
		self.assertFalse(can_use)
		self.assertIn("expired", message)

	def test_coupon_usage_limit(self):
		"""Test coupon usage limit"""
		coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "LIMITED",
				"applicable_to": "Course",
				"discount_type": "Percentage",
				"discount_value": 10,
				"course": self.course.name,
				"is_active": 1,
				"max_uses": 2,
				"used_count": 2,
			}
		).insert(ignore_permissions=True)

		can_use, message = coupon.can_use_coupon()
		self.assertFalse(can_use)
		self.assertIn("usage limit exceeded", message)

	def test_increment_usage(self):
		"""Test usage increment"""
		coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "INCREMENT",
				"applicable_to": "Course",
				"discount_type": "Percentage",
				"discount_value": 10,
				"course": self.course.name,
				"is_active": 1,
				"max_uses": 100,
				"used_count": 0,
			}
		).insert(ignore_permissions=True)

		initial_count = coupon.used_count
		coupon.increment_usage()

		coupon.reload()
		self.assertEqual(coupon.used_count, initial_count + 1)
