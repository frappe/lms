import frappe

from lms.lms.api import get_certified_participants
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_order_summary


class TestCertificationMemberNameFilter(BaseTestUtils):
	"""The member_name filter indexed value[1] on whatever the client sent: an IndexError
	500 on a one-character string, and the wrong pattern on a longer one. Guards both
	the plain string and the ["like", pattern] pair the SPA sends."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.member = cls._create_user(f"cert-filter-{hash}@example.com", "Zed", f"Q{hash}", ["LMS Student"])
		instructor = cls._create_user(f"cert-filter-i-{hash}@example.com", "Ivy", "Instr", ["Course Creator"])
		cls.course = cls._create_course(title=f"Filter Course {hash}", instructor=instructor.email)
		cls._create_enrollment(cls.member.email, cls.course.name)
		cls._create_certificate(cls.course.name, cls.member.email)
		cls.surname = f"Q{hash}"

	def _members(self, value):
		return {row.full_name for row in get_certified_participants(filters={"member_name": value})}

	def test_a_one_character_string_is_accepted(self):
		self.assertIsInstance(get_certified_participants(filters={"member_name": "Z"}), list)

	def test_a_plain_string_matches_by_name(self):
		self.assertIn(self.member.full_name, self._members(self.surname))

	def test_an_operator_pair_matches_by_name(self):
		self.assertIn(self.member.full_name, self._members(["like", f"%{self.surname}%"]))

	def test_a_pair_whose_pattern_is_not_a_string_is_accepted(self):
		for value in (["like", ["%"]], ["like", {"a": 1}], ["like", 5]):
			with self.subTest(value=value):
				self.assertIsInstance(get_certified_participants(filters={"member_name": value}), list)


class TestOrderSummaryForUnknownDocname(BaseTestUtils):
	"""get_order_summary read attributes off a None get_value for an unknown course or
	batch, an AttributeError 500. Guards a stated DoesNotExistError instead."""

	def test_unknown_course(self):
		with self.assertRaises(frappe.DoesNotExistError):
			get_order_summary("LMS Course", "no-such-course-at-all")

	def test_unknown_batch(self):
		with self.assertRaises(frappe.DoesNotExistError):
			get_order_summary("LMS Batch", "no-such-batch-at-all")
