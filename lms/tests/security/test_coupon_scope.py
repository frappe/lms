# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import frappe
import frappe.client

from lms.lms.permissions import coupon_query_conditions
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_order_summary

COURSE_PRICE = 1000


class TestCouponScope(BaseTestUtils):
	"""A coupon belongs to the authors of every course and batch it applies to.

	Before this rule, a Course Creator or Batch Evaluator with no relationship to a
	course minted a 100%-off code for it, repointed the merchant's live code at it, and
	deleted the merchant's code -- all through the generic REST surface, reachable
	because the list read was unscoped too.
	"""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.hash = hash
		cls.author = cls._create_user(f"cpsa-{hash}@example.com", "Ann", "Author", ["Course Creator"])
		cls.outsider = cls._create_user(f"cpso-{hash}@example.com", "Otto", "Outside", ["Course Creator"])
		cls.evaluator = cls._create_user(f"cpse-{hash}@example.com", "Eve", "Eval", ["Batch Evaluator"])
		cls.moderator = cls._create_user(f"cpsm-{hash}@example.com", "Mo", "Derator", ["Moderator"])
		cls.learner = cls._create_user(f"cpsl-{hash}@example.com", "Lee", "Learner", ["LMS Student"])

		cls.course = cls._create_course(title=f"Coupon Scope Course {hash}", instructor=cls.author.name)
		cls.course.db_set({"paid_course": 1, "course_price": COURSE_PRICE, "currency": "INR"}, notify=False)
		cls.other_course = cls._create_course(
			title=f"Coupon Scope Other {hash}", instructor=cls.outsider.name
		)
		cls._create_evaluator(cls.evaluator.name)
		cls.batch = cls._create_batch(
			course=cls.course.name,
			instructor=cls.author.name,
			title=f"Coupon Scope Batch {hash}",
			evaluator=cls.evaluator.name,
		)
		cls.other_batch = cls._create_batch(
			course=cls.other_course.name,
			instructor=cls.outsider.name,
			title=f"Coupon Scope Other Batch {hash}",
			evaluator=cls.evaluator.name,
		)

		# Somebody else's live discount code.
		cls.merchant_coupon = cls._new_coupon(f"WELCOME{hash.upper()}", 5, [("LMS Course", cls.course.name)])
		# The author's own coupon, on their own course and their own batch.
		cls.own_coupon = cls._new_coupon(
			f"MINE{hash.upper()}", 20, [("LMS Course", cls.course.name), ("LMS Batch", cls.batch.name)]
		)
		# A coupon spanning two authors: neither of them may touch it, only a Moderator.
		cls.mixed_coupon = cls._new_coupon(
			f"MIXED{hash.upper()}",
			10,
			[("LMS Course", cls.course.name), ("LMS Course", cls.other_course.name)],
		)
		# A coupon whose course no longer resolves. Link validation refuses a dangling
		# Dynamic Link on insert, so the row is repointed afterwards -- which is also how
		# it happens in the wild, when the course is deleted out from under it.
		cls.gone_coupon = cls._new_coupon(f"GONE{hash.upper()}", 10, [("LMS Course", cls.course.name)])
		frappe.db.set_value(
			"LMS Coupon Item",
			{"parent": cls.gone_coupon.name, "parenttype": "LMS Coupon"},
			"reference_name",
			f"cps-course-that-is-gone-{hash}",
			update_modified=False,
		)
		# A saved coupon that names nothing at all.
		cls.empty_coupon = cls._new_coupon(f"EMPTY{hash.upper()}", 10, [("LMS Course", cls.course.name)])
		frappe.db.delete("LMS Coupon Item", {"parent": cls.empty_coupon.name, "parenttype": "LMS Coupon"})

	@classmethod
	def _new_coupon(cls, code, percentage_discount, items, owner="Administrator"):
		original = frappe.session.user
		frappe.set_user(owner)
		try:
			coupon = frappe.new_doc("LMS Coupon")
			coupon.update(
				{
					"code": code,
					"discount_type": "Percentage",
					"percentage_discount": percentage_discount,
					"enabled": 1,
					"applicable_items": [
						{"reference_doctype": doctype, "reference_name": name} for doctype, name in items
					],
				}
			)
			coupon.insert()
			return coupon
		finally:
			frappe.set_user(original)

	def _as(self, user):
		frappe.set_user(user)
		return user

	def _listed(self):
		return {row.name for row in frappe.get_list("LMS Coupon", limit_page_length=0)}

	def _mint(self, course):
		coupon = frappe.new_doc("LMS Coupon")
		coupon.update(
			{
				"code": f"MINT{frappe.generate_hash(length=8).upper()}",
				"discount_type": "Percentage",
				"percentage_discount": 100,
				"enabled": 1,
				"applicable_items": [{"reference_doctype": "LMS Course", "reference_name": course}],
			}
		)
		coupon.insert()
		return coupon

	# The wrong actor, on both paths

	def test_an_unrelated_authoring_role_cannot_mint_a_discount_on_a_course_it_does_not_author(self):
		for actor in (self.outsider.name, self.evaluator.name):
			with self.subTest(actor=actor):
				self._as(actor)
				with self.assertRaises(frappe.PermissionError):
					self._mint(self.course.name)

	def test_an_unrelated_authoring_role_cannot_read_someone_elses_coupon(self):
		for actor in (self.outsider.name, self.evaluator.name):
			with self.subTest(actor=actor):
				self._as(actor)
				with self.assertRaises(frappe.PermissionError):
					frappe.client.get("LMS Coupon", self.merchant_coupon.name)

	def test_an_unrelated_authoring_role_cannot_list_someone_elses_coupon(self):
		for actor in (self.outsider.name, self.evaluator.name):
			with self.subTest(actor=actor):
				self._as(actor)
				self.assertNotIn(self.merchant_coupon.name, self._listed())

	def test_an_unrelated_authoring_role_cannot_repoint_the_merchants_code(self):
		"""The write path the coupon evidence measured: load a live code, repoint it at a
		course you do not author, set it to 100% off. It has to be refused on the coupon's
		persisted targets, not on the ones the caller has just typed."""
		self._as(self.evaluator.name)
		coupon = frappe.get_doc("LMS Coupon", self.merchant_coupon.name)
		coupon.percentage_discount = 100
		coupon.applicable_items = []
		coupon.append(
			"applicable_items", {"reference_doctype": "LMS Course", "reference_name": self.other_course.name}
		)
		with self.assertRaises(frappe.PermissionError):
			coupon.save()

		self._as("Administrator")
		self.assertEqual(
			frappe.db.get_value("LMS Coupon", self.merchant_coupon.name, "percentage_discount"), 5
		)
		self.assertEqual(
			frappe.db.get_value("LMS Coupon", self.merchant_coupon.name, "code"), self.merchant_coupon.code
		)

	def test_an_author_cannot_repoint_their_own_coupon_at_someone_elses_course(self):
		"""The mirror image: the persisted targets are the author's own, so a gate that
		read only those would allow the repoint. The incoming rows are checked too."""
		self._as(self.author.name)
		coupon = frappe.get_doc("LMS Coupon", self.own_coupon.name)
		coupon.append(
			"applicable_items", {"reference_doctype": "LMS Course", "reference_name": self.other_course.name}
		)
		with self.assertRaises(frappe.PermissionError):
			coupon.save()

		self._as("Administrator")
		self.assertEqual(
			frappe.db.count("LMS Coupon Item", {"parent": self.own_coupon.name, "parenttype": "LMS Coupon"}),
			2,
		)

	def test_an_author_cannot_repoint_a_batch_coupon_at_a_batch_they_do_not_instruct(self):
		"""Batch authorship is can_modify_batch, checked STORED+submitted the same way
		as course authorship."""
		self._as(self.author.name)
		coupon = frappe.get_doc("LMS Coupon", self.own_coupon.name)
		coupon.applicable_items = []
		coupon.append(
			"applicable_items", {"reference_doctype": "LMS Batch", "reference_name": self.other_batch.name}
		)
		with self.assertRaises(frappe.PermissionError):
			coupon.save()

		self._as("Administrator")
		self.assertEqual(
			frappe.db.count("LMS Coupon Item", {"parent": self.own_coupon.name, "parenttype": "LMS Coupon"}),
			2,
		)

	def test_an_unrelated_authoring_role_cannot_delete_the_merchants_code(self):
		for actor in (self.outsider.name, self.evaluator.name):
			with self.subTest(actor=actor):
				self._as(actor)
				with self.assertRaises(frappe.PermissionError):
					frappe.delete_doc("LMS Coupon", self.merchant_coupon.name)
				self._as("Administrator")
				self.assertTrue(frappe.db.exists("LMS Coupon", self.merchant_coupon.name))

	def test_a_coupon_spanning_two_authors_belongs_to_neither(self):
		for actor in (self.author.name, self.outsider.name):
			with self.subTest(actor=actor):
				self._as(actor)
				self.assertNotIn(self.mixed_coupon.name, self._listed())
				with self.assertRaises(frappe.PermissionError):
					frappe.client.get("LMS Coupon", self.mixed_coupon.name)

	def test_a_coupon_whose_course_is_gone_is_denied_not_shown(self):
		self._as(self.author.name)
		doc = frappe.get_doc("LMS Coupon", self.gone_coupon.name)
		self.assertFalse(frappe.has_permission("LMS Coupon", "read", doc=doc, user=self.author.name))
		self.assertNotIn(self.gone_coupon.name, self._listed())

	def test_a_coupon_whose_batch_is_gone_is_denied_even_to_its_old_instructor(self):
		batch = self._create_batch(
			course=self.course.name,
			instructor=self.author.name,
			title=f"Coupon Scope Gone Batch {self.hash}",
			evaluator=self.evaluator.name,
		)
		coupon = self._new_coupon(f"GONEB{self.hash.upper()}", 10, [("LMS Batch", batch.name)])
		# delete_batch removes the batch row but leaves its Course Instructor rows.
		frappe.db.delete("LMS Batch", batch.name)

		self._as(self.author.name)
		doc = frappe.get_doc("LMS Coupon", coupon.name)
		self.assertFalse(frappe.has_permission("LMS Coupon", "read", doc=doc, user=self.author.name))
		self.assertNotIn(coupon.name, self._listed())

	def test_a_saved_coupon_that_names_nothing_is_denied_not_shown(self):
		"""An empty applicable_items is only "no opinion" on a new document, where
		_validate_mandatory has not run yet. A saved coupon that names nothing is
		unresolvable, and the query condition forms no group for it."""
		self._as(self.author.name)
		doc = frappe.get_doc("LMS Coupon", self.empty_coupon.name)
		self.assertFalse(frappe.has_permission("LMS Coupon", "read", doc=doc, user=self.author.name))
		self.assertNotIn(self.empty_coupon.name, self._listed())

	def test_a_half_filled_applicable_item_defers_to_the_mandatory_check(self):
		"""reference_name is reqd on LMS Coupon Item, but _validate_mandatory only runs
		inside validate(), after the "create" permission check. A row that sets
		reference_doctype without reference_name must reach that friendlier error, not a
		bare, message-less PermissionError."""
		self._as(self.author.name)
		coupon = frappe.new_doc("LMS Coupon")
		coupon.update(
			{
				"code": f"HALF{frappe.generate_hash(length=8).upper()}",
				"discount_type": "Percentage",
				"percentage_discount": 10,
				"enabled": 1,
				"applicable_items": [{"reference_doctype": "LMS Course"}],
			}
		)
		with self.assertRaises(frappe.MandatoryError):
			coupon.insert()

		self._mint(self.course.name)

	def test_a_learner_and_a_guest_still_reach_no_coupon_at_all(self):
		for caller in (self.learner.name, "Guest"):
			with self.subTest(caller=caller):
				self._as(caller)
				with self.assertRaises(frappe.PermissionError):
					frappe.client.get("LMS Coupon", self.merchant_coupon.name)
				with self.assertRaises(frappe.PermissionError):
					frappe.get_list("LMS Coupon", limit_page_length=0)

	# Controls the fix must not move

	def test_the_courses_own_instructor_still_authors_a_coupon_on_their_own_course(self):
		self._as(self.author.name)
		coupon = self._mint(self.course.name)
		self.assertEqual(coupon.owner, self.author.name)
		self.assertIn(coupon.name, self._listed())
		self.assertEqual(frappe.client.get("LMS Coupon", coupon.name)["code"], coupon.code)

	def test_the_batchs_own_instructor_still_reaches_a_coupon_on_their_batch(self):
		self._as(self.author.name)
		self.assertIn(self.own_coupon.name, self._listed())
		self.assertEqual(frappe.client.get("LMS Coupon", self.own_coupon.name)["code"], self.own_coupon.code)

	def test_a_moderator_still_authors_a_coupon_and_a_learner_still_redeems_it(self):
		"""The legitimate path: Moderator is the only role the product offers
		Settings > Payments > Coupons to, and the code it writes has to reach checkout."""
		self._as(self.moderator.name)
		code = f"LEGIT{frappe.generate_hash(length=8).upper()}"
		coupon = frappe.new_doc("LMS Coupon")
		coupon.update(
			{
				"code": code,
				"discount_type": "Percentage",
				"percentage_discount": 20,
				"enabled": 1,
				"applicable_items": [{"reference_doctype": "LMS Course", "reference_name": self.course.name}],
			}
		)
		coupon.insert()
		self.assertIn(coupon.name, self._listed())

		self._as(self.learner.name)
		summary = get_order_summary("LMS Course", self.course.name, coupon=code)
		self.assertEqual(summary.discount_amount, COURSE_PRICE * 0.2)
		self.assertEqual(summary.total_amount, COURSE_PRICE * 0.8)

	def test_a_system_manager_still_reaches_a_coupon_it_does_not_author(self):
		admin = self._create_user(f"cps-sm-{self.hash}@example.com", "Sys", "Admin", ["System Manager"])
		self._as(admin.name)
		self.assertIn(self.merchant_coupon.name, self._listed())
		self.assertEqual(
			frappe.client.get("LMS Coupon", self.merchant_coupon.name)["code"], self.merchant_coupon.code
		)

	def test_redemption_still_works_for_a_coupon_the_redeemer_cannot_read(self):
		"""Checkout resolves the code with frappe.db.*, which never consults the query
		condition, so narrowing the coupon surface must not narrow redemption."""
		self._as(self.learner.name)
		with self.assertRaises(frappe.PermissionError):
			frappe.get_list("LMS Coupon", limit_page_length=0)
		summary = get_order_summary("LMS Course", self.course.name, coupon=self.merchant_coupon.code)
		self.assertEqual(summary.discount_amount, COURSE_PRICE * 0.05)

	# The two layers

	def test_the_two_layers_agree_for_every_actor_on_every_coupon(self):
		coupons = (
			self.merchant_coupon.name,
			self.own_coupon.name,
			self.mixed_coupon.name,
			self.gone_coupon.name,
			self.empty_coupon.name,
		)
		for actor in (self.author.name, self.outsider.name, self.evaluator.name, self.moderator.name):
			for name in coupons:
				with self.subTest(actor=actor, coupon=name):
					self._as(actor)
					listed = name in self._listed()
					doc = frappe.get_doc("LMS Coupon", name)
					self.assertEqual(
						frappe.has_permission("LMS Coupon", "read", doc=doc, user=actor),
						listed,
						f"{actor} disagrees on {name}",
					)

	# The child table

	def test_the_child_table_read_is_scoped_by_its_parents_rule(self):
		"""LMS Coupon Item needs no hook of its own, and this is why.

		It is `istable: 1` with `"permissions": []`. A child list read has to name its
		parent, and the engine then sets `permission_doctype` to that parent, inner-joins
		the parent table and applies the **parent's** query condition
		(`frappe/database/query.py:1755-1790`). So scoping LMS Coupon scopes
		`/api/resource/LMS Coupon Item?parent=LMS Coupon` with it.
		"""
		self._as(self.outsider.name)
		rows = frappe.client.get_list(
			"LMS Coupon Item",
			parent="LMS Coupon",
			limit_page_length=0,
			fields='["name","parent","reference_doctype","reference_name"]',
		)
		parents = {row["parent"] for row in rows}
		self.assertNotIn(self.merchant_coupon.name, parents)
		self.assertNotIn(self.own_coupon.name, parents)
		self.assertNotIn(self.mixed_coupon.name, parents)

	def test_the_child_tables_own_instructor_still_reads_their_rows(self):
		self._as(self.author.name)
		rows = frappe.client.get_list(
			"LMS Coupon Item", parent="LMS Coupon", limit_page_length=0, fields='["name","parent"]'
		)
		self.assertIn(self.own_coupon.name, {row["parent"] for row in rows})

	def test_a_single_child_row_is_refused_on_its_own(self):
		"""The doc door is shut for everyone: a child row has no standalone read."""
		self._as(self.outsider.name)
		child = frappe.db.get_value(
			"LMS Coupon Item", {"parent": self.merchant_coupon.name, "parenttype": "LMS Coupon"}, "name"
		)
		with self.assertRaises(frappe.PermissionError):
			frappe.client.get("LMS Coupon Item", child)

	# Registration and shape

	def test_both_halves_are_registered_for_lms_coupon(self):
		self.assertEqual(
			frappe.get_hooks("has_permission").get("LMS Coupon"),
			["lms.lms.permissions.coupon_has_permission"],
		)
		self.assertEqual(
			frappe.get_hooks("permission_query_conditions").get("LMS Coupon"),
			["lms.lms.permissions.coupon_query_conditions"],
		)

	def test_the_query_condition_is_a_plain_string_that_escapes_the_user(self):
		condition = coupon_query_conditions(self.outsider.name)
		self.assertIsInstance(condition, str)
		self.assertIn(frappe.db.escape(self.outsider.name), condition)
		self.assertNotIn("not in", condition)

	def test_the_query_condition_declines_to_narrow_a_moderator(self):
		self.assertEqual(coupon_query_conditions(self.moderator.name), "")
		self.assertEqual(coupon_query_conditions("Administrator"), "")
