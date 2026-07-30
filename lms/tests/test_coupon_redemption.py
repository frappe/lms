# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

import threading
from unittest.mock import patch

import frappe

from lms.lms.doctype.lms_payment.lms_payment import (
	UNIQUE_PAYMENT_ID,
	add_unique_payment_id_constraint,
)
from lms.lms.payments import get_payment_link
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import complete_enrollment, update_coupon_redemption, update_payment_record

# A worker that never reaches the barrier must not hang the whole suite.
THREAD_TIMEOUT = 30

BILLING_ADDRESS = {
	"billing_name": "Coupon Tester",
	"address_line1": "1 Test Street",
	"city": "Mumbai",
	"country": "India",
	"source": "Website",
	"member_consent": 1,
}


class TestCouponRedemption(BaseTestUtils):
	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"cinstr-{hash}@example.com", "Ida", "Instr", ["Course Creator", "Moderator"]
		)
		self.course = self._create_course(
			title=f"Coupon Redemption Course {hash}", instructor=self.instructor.email
		)
		self.course.db_set({"paid_course": 1, "course_price": 1000, "currency": "INR"})
		self.extra_courses = []

	def tearDown(self):
		self._delete_course_records()
		super().tearDown()

	def _delete_course_records(self):
		"""Some tests commit, so the framework's rollback cannot undo them."""
		courses = [self.course.name] + [course.name for course in self.extra_courses]
		for doctype, field in (("LMS Enrollment", "course"), ("LMS Payment", "payment_for_document")):
			for name in frappe.get_all(doctype, {field: ("in", courses)}, pluck="name"):
				frappe.delete_doc(doctype, name, force=True, ignore_permissions=True)
		frappe.db.commit()  # nosemgrep

	def _create_coupon(self, redemption_count=0, usage_limit=None, percentage_discount=10):
		coupon = frappe.new_doc("LMS Coupon")
		coupon.update(
			{
				"code": f"RACE{frappe.generate_hash(length=8)}",
				"discount_type": "Percentage",
				"percentage_discount": percentage_discount,
				"usage_limit": usage_limit,
				"enabled": 1,
				"applicable_items": [{"reference_doctype": "LMS Course", "reference_name": self.course.name}],
			}
		)
		coupon.save(ignore_permissions=True)
		self.cleanup_items.append(("LMS Coupon", coupon.name))

		if redemption_count:
			frappe.db.set_value("LMS Coupon", coupon.name, "redemption_count", redemption_count)

		return coupon

	def _create_address(self):
		address = frappe.new_doc("Address")
		address.update(
			{
				"address_title": f"Coupon Tester {frappe.generate_hash(length=8)}",
				"address_type": "Billing",
				"address_line1": "1 Test Street",
				"city": "Mumbai",
				"country": "India",
				"email_id": frappe.session.user,
			}
		)
		address.save(ignore_permissions=True)
		self.cleanup_items.append(("Address", address.name))
		return address

	def _create_source(self):
		if not frappe.db.exists("LMS Source", "Website"):
			frappe.get_doc({"doctype": "LMS Source", "source": "Website"}).insert(ignore_permissions=True)
		return "Website"

	def _create_payment(self, coupon=None, amount=1000, payment_for_certificate=0, course=None):
		payment = frappe.new_doc("LMS Payment")
		payment.update(
			{
				"member": frappe.session.user,
				"billing_name": "Coupon Tester",
				"address": self._create_address().name,
				"source": self._create_source(),
				"amount": amount,
				"currency": "INR",
				"payment_for_document_type": "LMS Course",
				"payment_for_document": course or self.course.name,
				"payment_for_certificate": payment_for_certificate,
				"coupon": coupon.name if coupon else None,
			}
		)
		payment.save(ignore_permissions=True)
		self.cleanup_items.append(("LMS Payment", payment.name))
		return payment

	def _payment_doc(self, payment, coupon, amount=1000):
		return frappe._dict(coupon=coupon.name if coupon else None, name=payment.name, amount=amount)

	def _count(self, coupon):
		return frappe.db.get_value("LMS Coupon", coupon.name, "redemption_count")

	def _callback(self, payment, razorpay_payment_id, course=None):
		"""What the gateway controller does before handing over: publish the
		payload of the callback it is handling."""
		frappe.flags.data = {
			"payment": payment.name,
			"payment_gateway": "Razorpay",
			"razorpay_payment_id": razorpay_payment_id,
		}
		try:
			update_payment_record("LMS Course", course or self.course.name)
		finally:
			frappe.flags.data = None

	def _checkout(self, coupon, address=None):
		return get_payment_link(
			doctype="LMS Course",
			docname=self.course.name,
			address=address or BILLING_ADDRESS,
			payment_for_certificate=0,
			coupon_code=coupon.code,
		)

	def _drop_unique_payment_id(self):
		# Constant identifier, and the test puts the constraint back.
		frappe.db.sql_ddl(f"alter table `tabLMS Payment` drop index `{UNIQUE_PAYMENT_ID}`")

	def _is_enrolled(self):
		return bool(
			frappe.db.exists("LMS Enrollment", {"member": frappe.session.user, "course": self.course.name})
		)

	# Counting

	def test_increments_redemption_count(self):
		coupon = self._create_coupon()
		payment = self._create_payment(coupon)

		update_coupon_redemption(self._payment_doc(payment, coupon))

		self.assertEqual(self._count(coupon), 1)

	def test_no_coupon_is_a_noop(self):
		coupon = self._create_coupon()
		payment = self._create_payment()

		update_coupon_redemption(self._payment_doc(payment, coupon=None))

		self.assertEqual(self._count(coupon), 0)

	def test_separate_payments_each_count(self):
		coupon = self._create_coupon()

		for _ in range(5):
			payment = self._create_payment(coupon)
			update_coupon_redemption(self._payment_doc(payment, coupon))

		self.assertEqual(self._count(coupon), 5)

	def test_redemption_keeps_the_coupon_timestamp_current(self):
		"""The count is edited from the desk form too, which relies on `modified`
		to detect that it went stale."""
		coupon = self._create_coupon()
		payment = self._create_payment(coupon)
		modified_before = frappe.db.get_value("LMS Coupon", coupon.name, "modified")

		update_coupon_redemption(self._payment_doc(payment, coupon))

		self.assertNotEqual(frappe.db.get_value("LMS Coupon", coupon.name, "modified"), modified_before)

	def test_parallel_redemptions_are_not_lost(self):
		"""Two redemptions committing at the same time must both be counted, on
		real threads with their own database connections."""
		workers = 8
		coupon = self._create_coupon()
		payments = [self._create_payment(coupon) for _ in range(workers)]

		def redeem(payment):
			update_coupon_redemption(self._payment_doc(payment, coupon))

		self.assertEqual(self._in_parallel(coupon, redeem, payments), workers)

	# Usage limit

	def test_paid_redemption_past_the_usage_limit_is_still_recorded(self):
		coupon = self._create_coupon(redemption_count=1, usage_limit=1)
		payment = self._create_payment(coupon)

		with patch.object(frappe, "log_error") as log_error:
			update_coupon_redemption(self._payment_doc(payment, coupon))

		# The payment already went through, so the redemption is still recorded.
		self.assertEqual(self._count(coupon), 2)
		log_error.assert_called_once()
		self.assertIn(coupon.name, str(log_error.call_args))

	def test_free_redemption_past_the_usage_limit_is_rejected(self):
		"""Nothing has been paid on a fully discounted order, so the limit can
		still be enforced instead of merely logged."""
		coupon = self._create_coupon(redemption_count=1, usage_limit=1)
		payment = self._create_payment(coupon, amount=0)

		with self.assertRaises(frappe.ValidationError):
			update_coupon_redemption(self._payment_doc(payment, coupon, amount=0))

		self.assertEqual(self._count(coupon), 1)

	def test_does_not_log_within_usage_limit(self):
		coupon = self._create_coupon(redemption_count=0, usage_limit=5)
		payment = self._create_payment(coupon)

		with patch.object(frappe, "log_error") as log_error:
			update_coupon_redemption(self._payment_doc(payment, coupon))

		self.assertEqual(self._count(coupon), 1)
		log_error.assert_not_called()

	def test_does_not_log_when_no_usage_limit_set(self):
		coupon = self._create_coupon(redemption_count=99, usage_limit=0)
		payment = self._create_payment(coupon)

		with patch.object(frappe, "log_error") as log_error:
			update_coupon_redemption(self._payment_doc(payment, coupon))

		self.assertEqual(self._count(coupon), 100)
		log_error.assert_not_called()

	# Gateway callbacks

	def test_gateway_callback_enrolls_and_counts_one_redemption(self):
		coupon = self._create_coupon()
		payment = self._create_payment(coupon)

		self._callback(payment, "pay_first")

		self.assertEqual(frappe.db.get_value("LMS Payment", payment.name, "payment_received"), 1)
		self.assertTrue(self._is_enrolled())
		self.assertEqual(self._count(coupon), 1)

	def test_replayed_callback_does_not_credit_a_second_payment(self):
		"""A gateway retry can be resolved against a newer unpaid checkout. That
		payment must not be marked received, and the coupon must not be counted
		twice for money that arrived once."""
		coupon = self._create_coupon()
		paid = self._create_payment(coupon)
		self._callback(paid, "pay_first")

		open_checkout = self._create_payment(coupon)
		self._callback(open_checkout, "pay_first")

		self.assertEqual(frappe.db.get_value("LMS Payment", open_checkout.name, "payment_received"), 0)
		self.assertEqual(self._count(coupon), 1)

	def test_parallel_callbacks_for_one_payment_count_once(self):
		"""Two gateway retries for the same payment can arrive at once. Only one
		of them may count a redemption."""
		coupon = self._create_coupon()
		payment = self._create_payment(coupon)

		def deliver(_):
			self._callback(payment, "pay_first")

		self.assertEqual(self._in_parallel(coupon, deliver, [payment] * 4), 1)

	def test_parallel_callbacks_for_one_gateway_payment_credit_one_payment(self):
		"""Retries for one gateway payment can be resolved to different LMS
		Payment rows, which do not contend with each other. One transaction, one
		credited payment."""
		coupon = self._create_coupon()
		payments = [self._create_payment(coupon) for _ in range(2)]

		def deliver(payment):
			self._callback(payment, "pay_shared")

		self.assertEqual(self._in_parallel(coupon, deliver, payments), 1)

	def test_parallel_callbacks_are_serialized_without_the_constraint(self):
		"""A site carrying duplicate payment ids cannot take the constraint, and
		the two callbacks need not even be for the same course. It must still not
		credit two payments for one gateway payment."""
		coupon = self._create_coupon()
		other_course = self._create_second_course()
		payments = [
			self._create_payment(coupon),
			self._create_payment(coupon, course=other_course.name),
		]
		self._drop_unique_payment_id()

		def deliver(payment):
			self._callback(payment, "pay_shared", course=payment.payment_for_document)

		try:
			self.assertEqual(self._in_parallel(coupon, deliver, payments), 1)
		finally:
			add_unique_payment_id_constraint()

	def _create_second_course(self):
		course = self._create_course(
			title=f"Coupon Redemption Course {frappe.generate_hash(length=6)}",
			instructor=self.instructor.email,
		)
		course.db_set({"paid_course": 1, "course_price": 1000, "currency": "INR"})
		self.extra_courses.append(course)
		return course

	def test_missing_payment_record_fails_with_a_readable_error(self):
		with patch.object(frappe, "log_error"), self.assertRaises(frappe.ValidationError) as caught:
			complete_enrollment("LMS-PAY-does-not-exist", "LMS Course", self.course.name)

		self.assertIn("payment record", str(caught.exception))

	def test_certificate_purchase_enrolls_a_learner_who_is_not_enrolled(self):
		"""The purchase is recorded on the enrollment, so without one the learner
		pays and gets nothing — and never stops paying, because the checkout
		guard reads the same flag."""
		coupon = self._create_coupon()
		payment = self._create_payment(coupon, payment_for_certificate=1)

		complete_enrollment(payment.name, "LMS Course", self.course.name)

		enrollment = frappe.db.get_value(
			"LMS Enrollment",
			{"member": frappe.session.user, "course": self.course.name},
			["name", "purchased_certificate"],
			as_dict=True,
		)
		self.assertIsNotNone(enrollment)
		self.assertEqual(enrollment.purchased_certificate, 1)

	# Checkout

	def test_fully_discounted_checkout_enrolls_and_counts_one_redemption(self):
		coupon = self._create_coupon(percentage_discount=100)

		self._checkout(coupon)

		self.assertTrue(self._is_enrolled())
		self.assertEqual(self._count(coupon), 1)

	def test_repeat_free_checkout_does_not_burn_another_redemption(self):
		"""Nothing stops a learner calling checkout again on a course they are
		already enrolled in; it must not eat into the coupon's usage limit."""
		coupon = self._create_coupon(percentage_discount=100)
		self._checkout(coupon)

		for _ in range(3):
			self._checkout(coupon)

		self.assertEqual(self._count(coupon), 1)
		self.assertEqual(frappe.db.count("LMS Payment", {"coupon": coupon.name}), 1)

	def test_repeat_paid_checkout_does_not_create_a_second_payment(self):
		"""A stale tab or the back button must not charge a learner again for a
		course they already have."""
		coupon = self._create_coupon()
		payment = self._create_payment(coupon)
		self._callback(payment, "pay_first")

		self._checkout(coupon)

		self.assertEqual(frappe.db.count("LMS Payment", {"payment_for_document": self.course.name}), 1)
		self.assertEqual(self._count(coupon), 1)

	def test_repeat_checkout_still_saves_edited_billing_details(self):
		coupon = self._create_coupon()
		payment = self._create_payment(coupon)
		self._callback(payment, "pay_first")

		self._checkout(coupon, address={**BILLING_ADDRESS, "address_line1": "42 New Street"})

		address = frappe.get_last_doc("Address", filters={"email_id": frappe.session.user})
		self.assertEqual(address.address_line1, "42 New Street")

	# Threading

	def _in_parallel(self, coupon, work, items) -> int:
		"""Run work(item) once per item, each on its own connection, all at the
		same moment. Returns the resulting redemption count, read before the
		committed fixtures are cleaned up."""
		site = frappe.local.site
		# The workers run on their own connections, so the fixtures have to be
		# visible outside this test's transaction.
		frappe.db.commit()  # nosemgrep
		barrier = threading.Barrier(len(items))
		errors = []

		def run(item):
			try:
				frappe.init(site=site)
				frappe.connect()
				try:
					barrier.wait(timeout=THREAD_TIMEOUT)  # maximise overlap between the workers
					work(item)
					frappe.db.commit()  # nosemgrep
				finally:
					frappe.destroy()
			except Exception as e:  # surfaced in the assertion below
				errors.append(e)
				barrier.abort()  # don't strand the workers still waiting

		threads = [threading.Thread(target=run, args=(item,)) for item in items]
		try:
			for thread in threads:
				thread.start()
			for thread in threads:
				thread.join(timeout=THREAD_TIMEOUT)
				self.assertFalse(thread.is_alive(), "a worker did not finish")

			self.assertEqual(errors, [])
			return self._count(coupon)
		finally:
			self._commit_cleanup()

	def _commit_cleanup(self):
		"""The fixtures above were committed, so rolling back the test cannot
		remove them."""
		self._delete_course_records()
		for doctype, name in reversed(self.cleanup_items):
			if frappe.db.exists(doctype, name):
				frappe.delete_doc(doctype, name, force=True, ignore_permissions=True)
		self.cleanup_items = []
		frappe.db.commit()  # nosemgrep
