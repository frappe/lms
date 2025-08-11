import frappe
from frappe.utils import today, add_days
import unittest


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
				"course_price": 1000,
			}
		).insert(ignore_permissions=True)

		self.batch = frappe.get_doc(
			{
				"doctype": "LMS Batch",
				"title": "Test Batch",
				"description": "Test batch for coupon testing",
				"start_date": today(),
				"end_date": add_days(today(), 30),
				"start_time": "09:00:00",
				"end_time": "17:00:00",
				"timezone": "Asia/Kolkata",
				"batch_details": "<p>Test batch details for coupon testing</p>",
				"instructors": [{"instructor": instructor.name}],
				"courses": [{"course": self.course.name}],
				"amount": 1500,
			}
		).insert(ignore_permissions=True)

	def tearDown(self):
		frappe.db.rollback()

	def test_course_coupon_can_be_applied_to_course_only(self):
		course_coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "COURSE10",
				"applicable_to": "LMS Course",
				"applicable_reference": self.course.name,
				"discount_type": "Percentage",
				"discount_value": 10,
				"is_active": 1,
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		discount = course_coupon.calculate_discount("LMS Course", self.course.name)
		self.assertEqual(discount, 100)  # 10% of 1000

		with self.assertRaises(frappe.ValidationError):
			course_coupon.calculate_discount("LMS Batch", self.batch.name)

	def test_batch_coupon_can_be_applied_to_batch_only(self):
		batch_coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "BATCH20",
				"applicable_to": "LMS Batch",
				"applicable_reference": self.batch.name,
				"discount_type": "Percentage",
				"discount_value": 20,
				"is_active": 1,
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		discount = batch_coupon.calculate_discount("LMS Batch", self.batch.name)
		self.assertEqual(discount, 300)

		with self.assertRaises(frappe.ValidationError):
			batch_coupon.calculate_discount("LMS Course", self.course.name)

	def test_invalid_doctype_throws_error(self):
		coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "INVALID",
				"applicable_to": "LMS Course",
				"applicable_reference": self.course.name,
				"discount_type": "Percentage",
				"discount_value": 10,
				"is_active": 1,
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		with self.assertRaises(frappe.ValidationError):
			coupon.calculate_discount("Invalid DocType", "some-name")

	def test_coupon_specific_reference_validation(self):
		instructor = frappe.get_doc("User", "test@instructor.com")

		another_course = frappe.get_doc(
			{
				"doctype": "LMS Course",
				"title": "Another Course",
				"course_name": "another-course",
				"short_introduction": "Another test course",
				"description": "A comprehensive test course for validation testing",
				"instructors": [{"instructor": instructor.name}],
				"course_price": 500,
			}
		).insert(ignore_permissions=True)

		coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "SPECIFIC",
				"applicable_to": "LMS Course",
				"applicable_reference": self.course.name,
				"discount_type": "Percentage",
				"discount_value": 10,
				"is_active": 1,
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		discount = coupon.calculate_discount("LMS Course", self.course.name)
		self.assertEqual(discount, 100)

		with self.assertRaises(frappe.ValidationError):
			coupon.calculate_discount("LMS Course", another_course.name)

	def test_zero_price_item_validation(self):
		instructor = frappe.get_doc("User", "test@instructor.com")

		free_course = frappe.get_doc(
			{
				"doctype": "LMS Course",
				"title": "Free Course",
				"course_name": "free-course",
				"short_introduction": "Free test course",
				"description": "A comprehensive free test course",
				"instructors": [{"instructor": instructor.name}],
				"course_price": 0,
			}
		).insert(ignore_permissions=True)

		coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "FREECOURSE",
				"applicable_to": "LMS Course",
				"applicable_reference": free_course.name,
				"discount_type": "Percentage",
				"discount_value": 10,
				"is_active": 1,
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		with self.assertRaises(frappe.ValidationError):
			coupon.calculate_discount("LMS Course", free_course.name)

	def test_invalid_coupon_usage_inactive_coupon(self):
		inactive_coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "INACTIVE",
				"applicable_to": "LMS Course",
				"applicable_reference": self.course.name,
				"discount_type": "Percentage",
				"discount_value": 10,
				"is_active": 0,
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		with self.assertRaises(frappe.ValidationError):
			inactive_coupon.calculate_discount("LMS Course", self.course.name)

	def test_invalid_coupon_usage_future_coupon(self):
		future_coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "FUTURE",
				"applicable_to": "LMS Course",
				"applicable_reference": self.course.name,
				"discount_type": "Percentage",
				"discount_value": 10,
				"is_active": 1,
				"valid_from": add_days(today(), 1),
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		with self.assertRaises(frappe.ValidationError):
			future_coupon.calculate_discount("LMS Course", self.course.name)

	def test_invalid_coupon_usage_expired_coupon(self):
		expired_coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "EXPIRED",
				"applicable_to": "LMS Course",
				"applicable_reference": self.course.name,
				"discount_type": "Percentage",
				"discount_value": 10,
				"is_active": 1,
				"valid_till": add_days(today(), -1),
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		with self.assertRaises(frappe.ValidationError):
			expired_coupon.calculate_discount("LMS Course", self.course.name)

	def test_invalid_coupon_usage_limit_exceeded(self):
		limited_coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "LIMITED",
				"applicable_to": "LMS Course",
				"applicable_reference": self.course.name,
				"discount_type": "Percentage",
				"discount_value": 10,
				"is_active": 1,
				"max_uses": 2,
				"used_count": 2,
			}
		).insert(ignore_permissions=True)

		with self.assertRaises(frappe.ValidationError):
			limited_coupon.calculate_discount("LMS Course", self.course.name)

	def test_discount_calculation_course_percentage(self):
		coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "COURSE10",
				"applicable_to": "LMS Course",
				"applicable_reference": self.course.name,
				"discount_type": "Percentage",
				"discount_value": 10,
				"is_active": 1,
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		discount = coupon.calculate_discount("LMS Course", self.course.name)
		self.assertEqual(discount, 100)

	def test_discount_calculation_batch_fixed_amount(self):
		coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "BATCH50",
				"applicable_to": "LMS Batch",
				"applicable_reference": self.batch.name,
				"discount_type": "Fixed Amount",
				"discount_value": 200,
				"is_active": 1,
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		discount = coupon.calculate_discount("LMS Batch", self.batch.name)
		self.assertEqual(discount, 200)

	def test_discount_calculation_fixed_amount_exceeds_price(self):
		coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "BIGDISCOUNT",
				"applicable_to": "LMS Course",
				"applicable_reference": self.course.name,
				"discount_type": "Fixed Amount",
				"discount_value": 2000,
				"is_active": 1,
				"max_uses": 100,
			}
		).insert(ignore_permissions=True)

		discount = coupon.calculate_discount("LMS Course", self.course.name)
		self.assertEqual(discount, 1000)

	def test_usage_increment(self):
		coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "INCREMENT",
				"applicable_to": "LMS Course",
				"applicable_reference": self.course.name,
				"discount_type": "Percentage",
				"discount_value": 10,
				"is_active": 1,
				"max_uses": 100,
				"used_count": 0,
			}
		).insert(ignore_permissions=True)

		initial_count = coupon.used_count
		coupon.increment_usage()

		coupon.reload()
		self.assertEqual(coupon.used_count, initial_count + 1)

	def test_can_use_coupon_valid_cases(self):
		valid_coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "VALID",
				"applicable_to": "LMS Course",
				"applicable_reference": self.course.name,
				"discount_type": "Percentage",
				"discount_value": 10,
				"is_active": 1,
				"max_uses": 100,
				"used_count": 0,
			}
		).insert(ignore_permissions=True)

		can_use, message = valid_coupon.can_use_coupon()
		self.assertTrue(can_use)
		self.assertEqual(message, "Coupon is valid")

	def test_validate_discount_value_percentage(self):
		coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "VALID50",
				"applicable_to": "LMS Course",
				"applicable_reference": self.course.name,
				"discount_type": "Percentage",
				"discount_value": 50,
				"is_active": 1,
			}
		)

		coupon.validate_discount_value()

		invalid_coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "INVALID150",
				"applicable_to": "LMS Course",
				"applicable_reference": self.course.name,
				"discount_type": "Percentage",
				"discount_value": 150,
				"is_active": 1,
			}
		)
		with self.assertRaises(frappe.ValidationError):
			invalid_coupon.validate_discount_value()

	def test_validate_discount_value_fixed_amount(self):
		coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "VALID100",
				"applicable_to": "LMS Course",
				"applicable_reference": self.course.name,
				"discount_type": "Fixed Amount",
				"discount_value": 100,
				"is_active": 1,
			}
		)
		coupon.validate_discount_value()

		invalid_coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "INVALIDNEG",
				"applicable_to": "LMS Course",
				"applicable_reference": self.course.name,
				"discount_type": "Fixed Amount",
				"discount_value": -50,
				"is_active": 1,
			}
		)
		with self.assertRaises(frappe.ValidationError):
			invalid_coupon.validate_discount_value()

	def test_get_applicable_reference(self):
		course_coupon = frappe.get_doc(
			{
				"doctype": "LMS Coupon",
				"coupon_code": "COURSEREF",
				"applicable_to": "LMS Course",
				"applicable_reference": self.course.name,
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
				"applicable_to": "LMS Batch",
				"applicable_reference": self.batch.name,
				"discount_type": "Percentage",
				"discount_value": 15,
				"is_active": 1,
			}
		).insert(ignore_permissions=True)

		self.assertEqual(batch_coupon.get_applicable_reference(), self.batch.name)
