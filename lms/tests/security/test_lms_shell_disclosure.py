# Copyright (c) 2026, FOSS United and Contributors
# See license.txt
"""The /lms shell renders for every visitor, Guest included, before the SPA has
asked anything. What it puts into the page is readable without any permission."""

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.www._lms import get_boot, get_meta_from_document


class TestShellMetaScope(BaseTestUtils):
	"""An unpublished course or batch is authoring-only, so its title, description
	and image stay out of the meta tags for anyone who cannot author or attend it."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.author = cls._create_user(f"meta-author-{hash}@example.com", "Meta", "Author", ["Course Creator"])
		cls.other_author = cls._create_user(
			f"meta-other-{hash}@example.com", "Other", "Author", ["Course Creator"]
		)
		cls.moderator = cls._create_user(f"meta-mod-{hash}@example.com", "Meta", "Mod", ["Moderator"])
		cls.student = cls._create_user(f"meta-stud-{hash}@example.com", "Meta", "Stud", ["LMS Student"])
		cls.enrolled = cls._create_user(f"meta-enr-{hash}@example.com", "Meta", "Enr", ["LMS Student"])

		cls.draft = cls._create_course(f"Meta Draft {hash}", instructor=cls.author.name)
		frappe.db.set_value("LMS Course", cls.draft.name, "published", 0)
		cls.live = cls._create_course(f"Meta Live {hash}", instructor=cls.author.name)
		cls._create_enrollment(cls.enrolled.name, cls.draft.name)

		cls.draft_batch = cls._make_batch(f"Meta Draft Batch {hash}", 0)
		cls.live_batch = cls._make_batch(f"Meta Live Batch {hash}", 1)
		cls._create_batch_enrollment(cls.enrolled.name, cls.draft_batch.name)

	@classmethod
	def _make_batch(cls, title, published):
		batch = frappe.new_doc("LMS Batch")
		batch.update(
			{
				"title": title,
				"published": published,
				"start_date": "2026-01-01",
				"end_date": "2026-12-31",
				"start_time": "10:00:00",
				"end_time": "11:00:00",
				"timezone": "Asia/Kolkata",
				"description": "description",
				"batch_details": f"{title} details",
				"instructors": [{"instructor": cls.author.name}],
			}
		)
		batch.save()
		return batch

	def meta_as(self, user, app_path):
		frappe.set_user(user)
		try:
			return get_meta_from_document(app_path) or {}
		finally:
			frappe.set_user("Administrator")

	def draft_paths(self):
		return {
			f"courses/{self.draft.name}": self.draft.title,
			f"batches/{self.draft_batch.name}": self.draft_batch.title,
			f"batches/details/{self.draft_batch.name}": self.draft_batch.title,
		}

	def test_a_draft_renders_no_meta_for_guest_or_an_unrelated_user(self):
		"""Draft titles reached the meta tags since #1414.
		Added for audit finding #78 on branch fix/draft-and-guest-disclosure."""
		for user in ("Guest", self.student.name, self.other_author.name):
			for path, title in self.draft_paths().items():
				with self.subTest(user=user, path=path):
					meta = self.meta_as(user, path)
					self.assertNotIn(title, str(meta))
					self.assertFalse(meta.get("description"))

	def test_a_draft_still_renders_for_its_author_moderator_and_learner(self):
		for user in (self.author.name, self.moderator.name, self.enrolled.name):
			for path, title in self.draft_paths().items():
				with self.subTest(user=user, path=path):
					self.assertEqual(self.meta_as(user, path).get("title"), title)

	def test_a_published_course_and_batch_still_render_for_guest(self):
		self.assertEqual(self.meta_as("Guest", f"courses/{self.live.name}").get("title"), self.live.title)
		for path in (f"batches/{self.live_batch.name}", f"batches/details/{self.live_batch.name}"):
			with self.subTest(path=path):
				self.assertEqual(self.meta_as("Guest", path).get("title"), self.live_batch.title)


class TestShellBoot(BaseTestUtils):
	"""Core withholds the framework version from Guest (/api/method/version needs a
	login); the shell must not hand it out either. The SPA never reads it."""

	def test_the_boot_carries_no_framework_version(self):
		"""The boot carried frappe.__version__ to Guest since #1479.
		Added for audit finding #90 on branch fix/draft-and-guest-disclosure."""
		for user in ("Guest", "Administrator"):
			frappe.set_user(user)
			try:
				boot = get_boot()
			finally:
				frappe.set_user("Administrator")
			with self.subTest(user=user):
				self.assertNotIn("frappe_version", boot)
				self.assertNotIn(frappe.__version__, boot.values())
