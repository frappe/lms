# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

"""`LMS Course` must enforce `can_modify_course` on the generic doors, not only the
eleven `lms/lms/api.py` endpoints that call it directly. Assertions use `get_list`,
since `get_all` sets `ignore_permissions=True` and would pass with no hook at all.
"""

import frappe
from frappe.client import set_value

from lms.lms.test_helpers import BaseTestUtils


class TestCourseAuthoringScope(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		hash = frappe.generate_hash(length=6)

		# Narrowest users that satisfy each role: a Moderator that also carried
		# System Manager would hide every gap these tests exist to find.
		cls.moderator = cls._create_user(f"cas-mod-{hash}@example.com", "Mia", "Mod", ["Moderator"])
		cls.author = cls._create_user(f"cas-author-{hash}@example.com", "Ana", "Author", ["Course Creator"])
		cls.outsider = cls._create_user(
			f"cas-outsider-{hash}@example.com", "Otto", "Outsider", ["Course Creator"]
		)
		# A Course Creator enrolled as a learner: LMS Course grants DocPerms to Course
		# Creator, Moderator and System Manager only, so the enrolled branch of the
		# rule is only observable through a role that reaches the list surface.
		cls.learner = cls._create_user(
			f"cas-learner-{hash}@example.com", "Leo", "Learner", ["Course Creator"]
		)
		cls.student = cls._create_user(f"cas-student-{hash}@example.com", "Sam", "Student", ["LMS Student"])

		cls.author_draft = cls._draft_course(f"CAS Author Draft {hash}", cls.author.name)
		cls.outsider_draft = cls._draft_course(f"CAS Outsider Draft {hash}", cls.outsider.name)
		cls.published = cls._create_course(title=f"CAS Published {hash}", instructor=cls.author.name).name
		# Nothing links to this one, so a delete reaches the permission gate instead of
		# tripping frappe's LinkExistsError check first.
		cls.author_spare = cls._draft_course(f"CAS Author Spare {hash}", cls.author.name)

		cls._create_enrollment(cls.learner.name, cls.author_draft)

	@classmethod
	def _draft_course(cls, title, instructor):
		"""_create_course publishes; the interesting rows are the unpublished ones."""
		course = cls._create_course(title=title, instructor=instructor)
		course.published = 0
		course.save()
		return course.name

	def _as(self, user, fn):
		# frappe.set_user, not `frappe.session.user = ...`: only set_user clears the
		# frappe.local permission cache, so a bare assignment reuses the last actor's
		# answers and every role assertion below would be meaningless.
		frappe.set_user(user)
		try:
			return fn()
		finally:
			frappe.set_user("Administrator")

	def _listed(self, user):
		return self._as(user, lambda: frappe.get_list("LMS Course", pluck="name", limit_page_length=0))

	def _may(self, user, course, ptype):
		return self._as(user, lambda: frappe.has_permission("LMS Course", ptype, doc=course))

	def _read_actors(self):
		"""(label, user) for the roles that reach the LMS Course list surface."""
		return (
			("moderator", self.moderator.name),
			("author", self.author.name),
			("outsider", self.outsider.name),
			("enrolled_course_creator", self.learner.name),
		)

	# --- controls: this PR narrows an existing grant, so the legitimate actor needs a
	# --- guard the fix cannot move. These pass on develop and must keep passing.

	def test_an_author_can_still_create_write_and_list_their_own_course(self):
		def create():
			course = frappe.new_doc("LMS Course")
			course.update(
				{
					"title": f"CAS Created {frappe.generate_hash(length=6)}",
					"short_introduction": "x",
					"description": "x",
					"category": "Business",
					"published": 0,
					"instructors": [{"instructor": self.author.name}],
				}
			)
			course.insert()
			return course.name

		created = self._as(self.author.name, create)
		self.assertTrue(frappe.db.exists("LMS Course", created))

		self._as(
			self.author.name,
			lambda: set_value("LMS Course", self.author_draft, "short_introduction", "edited"),
		)
		self.assertEqual(frappe.db.get_value("LMS Course", self.author_draft, "short_introduction"), "edited")

		listed = self._listed(self.author.name)
		self.assertIn(self.author_draft, listed)
		self.assertIn(created, listed)

	def test_a_published_course_is_still_listed_to_every_role_that_reaches_the_list(self):
		for label, user in self._read_actors():
			with self.subTest(actor=label):
				self.assertIn(self.published, self._listed(user))

	def test_a_moderator_still_reaches_every_course_on_both_paths(self):
		for course in (self.author_draft, self.outsider_draft, self.published):
			with self.subTest(course=course):
				self.assertTrue(self._may(self.moderator.name, course, "write"))
				self.assertIn(course, self._listed(self.moderator.name))

	def test_creating_a_course_is_not_narrowed_by_this_rule(self):
		"""`create` stays governed by the DocPerm grant: frappe checks "create" before
		set_new_name() runs, so there is no name and no Course Instructor row yet to
		narrow on.
		"""

		def create_for_someone_else():
			course = frappe.new_doc("LMS Course")
			course.update(
				{
					"title": f"CAS For Other {frappe.generate_hash(length=6)}",
					"short_introduction": "x",
					"description": "x",
					"category": "Business",
					"published": 0,
					"instructors": [{"instructor": self.author.name}],
				}
			)
			course.insert()
			return course.name

		created = self._as(self.outsider.name, create_for_someone_else)
		self.assertTrue(frappe.db.exists("LMS Course", created))
		# ...and the creator immediately cannot author it, which is the rule working.
		self.assertFalse(self._may(self.outsider.name, created, "write"))

	# --- the narrowing: these fail on develop.

	def test_a_non_instructor_course_creator_cannot_write_another_authors_course(self):
		before = frappe.db.get_value("LMS Course", self.author_draft, "title")

		with self.assertRaises(frappe.PermissionError):
			self._as(
				self.outsider.name,
				lambda: set_value("LMS Course", self.author_draft, "title", "PWNED"),
			)

		self.assertTrue(frappe.db.exists("LMS Course", self.author_draft))
		self.assertEqual(frappe.db.get_value("LMS Course", self.author_draft, "title"), before)

	def test_a_non_instructor_course_creator_cannot_delete_another_authors_course(self):
		with self.assertRaises(frappe.PermissionError):
			self._as(self.outsider.name, lambda: frappe.delete_doc("LMS Course", self.author_spare))

		self.assertTrue(frappe.db.exists("LMS Course", self.author_spare))

	def test_another_authors_draft_is_absent_from_a_list_read(self):
		listed = self._listed(self.outsider.name)
		self.assertNotIn(self.author_draft, listed)
		self.assertIn(self.outsider_draft, listed, "control failed: the actor cannot see its own draft")

	def test_has_permission_matches_the_authoring_rule_for_every_actor(self):
		cases = (
			("moderator", self.moderator.name, self.author_draft, True),
			("author_own", self.author.name, self.author_draft, True),
			("author_published", self.author.name, self.published, True),
			("author_on_someone_elses", self.author.name, self.outsider_draft, False),
			("outsider_on_someone_elses", self.outsider.name, self.author_draft, False),
			("outsider_on_a_published_course", self.outsider.name, self.published, False),
			("outsider_own", self.outsider.name, self.outsider_draft, True),
			("enrolled_course_creator", self.learner.name, self.author_draft, False),
		)
		for ptype in ("write", "delete", "share"):
			for label, user, course, expected in cases:
				with self.subTest(ptype=ptype, case=label):
					self.assertEqual(self._may(user, course, ptype), expected)

	def test_has_permission_matches_the_read_rule_for_every_actor(self):
		cases = (
			("moderator_on_a_draft", self.moderator.name, self.author_draft, True),
			("author_own_draft", self.author.name, self.author_draft, True),
			("author_on_someone_elses_draft", self.author.name, self.outsider_draft, False),
			("outsider_on_someone_elses_draft", self.outsider.name, self.author_draft, False),
			("outsider_on_a_published_course", self.outsider.name, self.published, True),
			("enrolled_on_the_draft_they_joined", self.learner.name, self.author_draft, True),
			("enrolled_on_an_unrelated_draft", self.learner.name, self.outsider_draft, False),
			("guest_on_a_draft", "Guest", self.author_draft, False),
		)
		for ptype in ("read", "select", "print"):
			for label, user, course, expected in cases:
				with self.subTest(ptype=ptype, case=label):
					self.assertEqual(self._may(user, course, ptype), expected)

	def test_the_two_layers_agree_for_every_actor(self):
		"""The single-doc answer and the list answer must be the same sentence.

		Unlike the assessment rule's sequential lock, nothing in the course rule is
		inexpressible as SQL, so agreement here is total and any divergence is a bug.
		"""
		courses = (self.author_draft, self.outsider_draft, self.published)
		for label, user in self._read_actors():
			listed = set(self._listed(user))
			for course in courses:
				with self.subTest(actor=label, course=course):
					self.assertEqual(
						self._may(user, course, "read"),
						course in listed,
						f"{label}: has_permission and permission_query_conditions disagree",
					)

	def test_guest_and_a_plain_student_never_reach_the_course_list_surface(self):
		"""LMS Course grants no DocPerm to Guest, All or LMS Student, so
		check_select_permission refuses them before the query condition is ever
		consulted -- the read half of this rule is not student-facing.
		"""
		for label, user in (("guest", "Guest"), ("student", self.student.name)):
			with self.subTest(actor=label):
				with self.assertRaises(frappe.PermissionError):
					self._listed(user)
