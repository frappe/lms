from unittest.mock import patch

import frappe

from lms.lms.api import get_member, get_members
from lms.lms.test_helpers import BaseTestUtils

MEMBERS_PAGE_LENGTH = 3


class TestGetMembers(BaseTestUtils):
	"""Settings > Users pages at MEMBERS_PAGE_LENGTH and searches the whole table.

	The frontend steps `start` by that same number, so a mismatch here silently
	skips or repeats a row on every Load More. Search has to reach past the
	first page, since the panel does not fetch the rest before searching.

	MEMBERS_PAGE_LENGTH is patched down to 3 for the whole class: get_members
	reads it from lms.lms.api at call time, so 7 users (a moderator plus two
	full patched pages) is enough to exercise every case below without the
	real page length's user count.
	"""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls._page_length_patch = patch("lms.lms.api.MEMBERS_PAGE_LENGTH", MEMBERS_PAGE_LENGTH)
		cls._page_length_patch.start()
		cls.addClassCleanup(cls._page_length_patch.stop)

		cls.moderator = cls._create_user("moderator@example.com", "Mod", "Erator", ["Moderator"])
		# Two full pages of its own, because the paging case below asserts that page
		# two is full.
		cls.members = [
			cls._create_user(f"member{index}@example.com", "Member", str(index), ["LMS Student"])
			for index in range(2 * MEMBERS_PAGE_LENGTH)
		]

	def setUp(self):
		super().setUp()
		frappe.set_user(self.moderator.name)

	def _users_in_one_query(self, limit):
		"""What get_members would return if it never paged, read straight from
		the table with the same filters and ordering.

		Deriving this by paging through get_members would make the paging test
		circular: it would agree with itself however wrongly it paged.
		"""
		return [
			user.name
			for user in frappe.get_all(
				"User",
				filters=[
					["enabled", "=", 1],
					["name", "not in", ["Administrator", "Guest"]],
				],
				fields=["name"],
				limit_page_length=limit,
				start=0,
			)
		]

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def test_first_page_stops_at_the_page_length(self):
		self.assertEqual(len(get_members()), MEMBERS_PAGE_LENGTH)

	def test_second_page_continues_the_first_without_gap_or_repeat(self):
		"""Disjointness alone is not enough: it stays true when page two comes
		back empty or skips rows, which are the regressions this claims to pin."""
		first = [member.name for member in get_members()]
		second = [member.name for member in get_members(start=MEMBERS_PAGE_LENGTH)]
		both = first + second

		self.assertEqual(len(first), MEMBERS_PAGE_LENGTH)
		self.assertEqual(len(second), MEMBERS_PAGE_LENGTH, "page two came back short")
		self.assertEqual(len(set(both)), len(both), "a row was served on both pages")
		self.assertEqual(
			both,
			self._users_in_one_query(2 * MEMBERS_PAGE_LENGTH),
			"the two pages do not reconstruct the unpaged list",
		)

	def test_search_reaches_a_member_past_the_first_page(self):
		target = self.members[-1]

		found = get_members(search=target.first_name + " " + target.last_name)

		self.assertIn(target.name, [member.name for member in found])

	def test_search_matches_the_email_too(self):
		target = self.members[-1]

		found = get_members(search=target.name)

		self.assertIn(target.name, [member.name for member in found])


class TestGetMember(BaseTestUtils):
	"""The member edit form seeds itself from one exact row.

	It used to ask get_members for it, which pages and hides disabled users, so
	the two cases below came back empty and left Save disabled with nothing on
	screen explaining why.

	MEMBERS_PAGE_LENGTH is patched to 3 for the whole class, same as TestGetMembers,
	and the fixture seeds one member MORE than a page holds. Counting the moderator
	towards that is not enough: on a site whose only users are this fixture's, the
	members are the newest rows and fill the first page by themselves, so nothing is
	left off it. Seeding PAGE_LENGTH + 1 members makes the overflow arithmetic rather
	than a property of whatever else the site happens to contain.
	"""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls._page_length_patch = patch("lms.lms.api.MEMBERS_PAGE_LENGTH", MEMBERS_PAGE_LENGTH)
		cls._page_length_patch.start()
		cls.addClassCleanup(cls._page_length_patch.stop)

		cls.moderator = cls._create_user("moderator@example.com", "Mod", "Erator", ["Moderator"])
		cls.members = [
			cls._create_user(f"member{index}@example.com", "Member", str(index), ["LMS Student"])
			for index in range(MEMBERS_PAGE_LENGTH + 1)
		]

	def setUp(self):
		super().setUp()
		frappe.set_user(self.moderator.name)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def test_returns_the_roles_of_the_member_asked_for(self):
		target = self.members[0]

		row = get_member(target.name)

		self.assertEqual(row.name, target.name)
		self.assertIn("LMS Student", row.roles)

	def test_reaches_a_member_past_the_first_page(self):
		# There are more fixture members than a page holds, so at least one is off it
		# whatever get_members' ordering does and whatever else is on the site. Which
		# one is not part of the contract, so take it from what page one left out.
		first_page = [member.name for member in get_members()]
		off_page = [member for member in self.members if member.name not in first_page]

		self.assertGreater(len(self.members), MEMBERS_PAGE_LENGTH, "fixture must exceed a page")
		self.assertTrue(off_page, "the fixture no longer exceeds one page")
		self.assertEqual(get_member(off_page[0].name).name, off_page[0].name)

	def test_reaches_a_disabled_member(self):
		target = self.members[0]
		frappe.db.set_value("User", target.name, "enabled", 0)

		self.assertNotIn(target.name, [member.name for member in get_members(search=target.name)])
		self.assertEqual(get_member(target.name).name, target.name)

	def test_rejects_a_member_that_does_not_exist(self):
		with self.assertRaises(frappe.DoesNotExistError):
			get_member("nobody@example.com")

	def test_rejects_the_built_in_accounts(self):
		for name in ["Administrator", "Guest"]:
			with self.assertRaises(frappe.ValidationError):
				get_member(name)

	def test_rejects_a_blank_member(self):
		with self.assertRaises(frappe.ValidationError):
			get_member("   ")
