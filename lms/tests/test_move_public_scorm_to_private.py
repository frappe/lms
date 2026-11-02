# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

"""The patch that brings legacy public/scorm packages behind SCORMRenderer's permission gate."""

import os
import shutil
import tempfile
from unittest.mock import patch

import frappe
from frappe.tests import UnitTestCase

from lms.lms.test_helpers import BaseTestUtils
from lms.page_renderers import SCORMRenderer
from lms.patches.v2_0 import move_public_scorm_to_private as relocation


class TestMovePublicScormToPrivate(UnitTestCase):
	def setUp(self):
		self._tmp = tempfile.TemporaryDirectory()
		self.site = self._tmp.name
		self.public_root = os.path.join(self.site, "public", "scorm")
		self.private_root = os.path.join(self.site, "private", "scorm")
		self.superseded_root = os.path.join(self.site, "private", "scorm_superseded")

		os.makedirs(self.public_root)
		os.makedirs(self.private_root)
		# A sibling under public/ that has nothing to do with SCORM and must survive.
		self.public_files = os.path.join(self.site, "public", "files")
		os.makedirs(self.public_files)
		open(os.path.join(self.public_files, "logo.png"), "w").close()

	def tearDown(self):
		self._tmp.cleanup()

	def _package(self, root, course="a-course", title="a-chapter", body="legacy"):
		path = os.path.join(root, course, title)
		os.makedirs(path)
		with open(os.path.join(path, "index.html"), "w") as f:
			f.write(body)
		return path

	def _relocate(self, roots=None):
		# Course Chapter is not what these cases are about; _report_unclaimed has its own.
		with patch.object(relocation, "_report_unclaimed", lambda packages: 0):
			return relocation.relocate(roots or [self.public_root], self.private_root, self.superseded_root)

	def _read(self, *path):
		with open(os.path.join(*path)) as f:
			return f.read()

	def test_a_legacy_package_moves_into_private(self):
		"""Pre-68e7b210e packages under public/scorm are served by nginx with no enrolment
		check. Guards that the patch moves them under private/, behind SCORMRenderer."""
		source = self._package(self.public_root)
		summary = self._relocate()

		self.assertEqual(summary["moved"], 1)
		self.assertFalse(os.path.exists(source))
		self.assertEqual(self._read(self.private_root, "a-course", "a-chapter", "index.html"), "legacy")

	def test_the_stored_url_resolves_from_private_afterwards(self):
		"""The patch writes no DB row, so the stored /scorm/... URL must resolve unchanged from private/."""
		self._package(self.public_root)
		self._relocate()

		renderer = SCORMRenderer.__new__(SCORMRenderer)
		renderer.path = "scorm/a-course/a-chapter/index.html"
		with (
			patch.object(frappe.local, "site_path", self.site),
			patch.object(SCORMRenderer, "_check_permission", lambda _self, course, package: None),
			patch.object(SCORMRenderer, "_serve_file", lambda _self, path: path),
		):
			served = renderer.render()

		expected = os.path.join(self.private_root, "a-course", "a-chapter", "index.html")
		self.assertEqual(served, os.path.realpath(expected))

	def test_a_package_whose_destination_is_taken_is_parked_not_merged(self):
		self._package(self.public_root, body="stale")
		self._package(self.private_root, body="current")

		summary = self._relocate()

		self.assertEqual(summary["moved"], 0)
		self.assertEqual(summary["superseded"], 1)
		self.assertEqual(self._read(self.private_root, "a-course", "a-chapter", "index.html"), "current")
		self.assertEqual(self._read(self.superseded_root, "a-course", "a-chapter", "index.html"), "stale")

	def test_running_it_twice_changes_nothing(self):
		self._package(self.public_root)
		first = self._relocate()

		# The first run pruned public/scorm, so the second returns before touching anything.
		with patch.object(frappe.local, "site_path", self.site):
			second = relocation.execute()

		self.assertEqual(first["moved"], 1)
		self.assertIsNone(second)
		self.assertEqual(self._read(self.private_root, "a-course", "a-chapter", "index.html"), "legacy")

	def test_execute_returns_early_when_there_is_no_legacy_tree(self):
		shutil.rmtree(self.public_root)
		with patch.object(frappe.local, "site_path", self.site):
			self.assertIsNone(relocation.execute())

	def test_execute_wires_the_three_roots_together(self):
		self._package(self.public_root)
		with (
			patch.object(frappe.local, "site_path", self.site),
			patch.object(relocation, "_report_unclaimed", lambda packages: 0),
		):
			summary = relocation.execute()

		self.assertEqual(summary["moved"], 1)
		self.assertTrue(
			os.path.isfile(os.path.join(self.private_root, "a-course", "a-chapter", "index.html"))
		)

	def test_every_package_moves_in_one_run(self):
		"""A patch that throws fails bench migrate, so it must not stop part-way to paginate."""
		for index in range(3):
			self._package(self.public_root, course=f"course-{index}")

		self.assertEqual(self._relocate()["moved"], 3)
		self.assertFalse(os.path.exists(self.public_root))
		for index in range(3):
			self.assertTrue(os.path.isdir(os.path.join(self.private_root, f"course-{index}", "a-chapter")))

	def test_three_copies_of_a_package_park_side_by_side(self):
		"""One current private copy plus a legacy copy under each root: the second parked
		copy must not collide with the first and fail every migrate from then on."""
		first_release_root = os.path.join(self.site, "public", "files", "scorm")
		self._package(self.private_root, body="current")
		self._package(self.public_root, body="stale-2025")
		self._package(first_release_root, body="stale-2024")

		summary = self._relocate([self.public_root, first_release_root])

		self.assertEqual(summary["superseded"], 2)
		self.assertEqual(self._read(self.private_root, "a-course", "a-chapter", "index.html"), "current")
		parked = sorted(
			self._read(self.superseded_root, "a-course", title, "index.html")
			for title in os.listdir(os.path.join(self.superseded_root, "a-course"))
		)
		self.assertEqual(parked, ["stale-2024", "stale-2025"])
		self.assertFalse(os.path.exists(self.public_root))
		self.assertFalse(os.path.exists(first_release_root))

	def test_a_package_parked_by_an_earlier_run_is_not_overwritten(self):
		self._package(self.private_root, body="current")
		self._package(self.superseded_root, body="parked-earlier")
		self._package(self.public_root, body="stale")

		self.assertEqual(self._relocate()["superseded"], 1)
		self.assertEqual(
			self._read(self.superseded_root, "a-course", "a-chapter", "index.html"), "parked-earlier"
		)
		self.assertEqual(self._read(self.superseded_root, "a-course", "a-chapter.1", "index.html"), "stale")

	def test_the_first_release_root_under_public_files_is_relocated_too(self):
		"""The first SCORM release (2e1aac493) extracted to public/files/scorm."""
		first_release_root = os.path.join(self.site, "public", "files", "scorm")
		os.makedirs(first_release_root)
		self._package(first_release_root, course="oldest-course", body="from-2024")
		self._package(self.public_root, course="newer-course")

		summary = self._relocate([self.public_root, first_release_root])

		self.assertEqual(summary["moved"], 2)
		self.assertEqual(
			self._read(self.private_root, "oldest-course", "a-chapter", "index.html"), "from-2024"
		)
		self.assertFalse(os.path.exists(first_release_root))
		# Pruning the scorm dir must not take public/files with it.
		self.assertTrue(os.path.isfile(os.path.join(self.public_files, "logo.png")))

	def test_execute_covers_both_legacy_roots(self):
		first_release_root = os.path.join(self.site, "public", "files", "scorm")
		os.makedirs(first_release_root)
		self._package(first_release_root, course="oldest-course")
		with (
			patch.object(frappe.local, "site_path", self.site),
			patch.object(relocation, "_report_unclaimed", lambda packages: 0),
		):
			summary = relocation.execute()

		self.assertEqual(summary["moved"], 1)

	def test_a_package_no_chapter_claims_is_counted_and_named(self):
		"""SCORMRenderer only serves a package a chapter's scorm_package_path names, so the rest are logged."""
		self._package(self.public_root, course="claimed-course", title="Chapter One")
		self._package(self.public_root, course="orphan-course", title="Chapter Two")

		chapters = ["/scorm/claimed-course/Chapter One"]
		with patch.object(relocation.frappe, "get_all", return_value=chapters):
			summary = relocation.relocate([self.public_root], self.private_root, self.superseded_root)

		self.assertEqual(summary["moved"], 2)
		self.assertEqual(summary["unclaimed"], 1)

	def test_a_package_that_cannot_move_throws_and_the_others_still_moved(self):
		self._package(self.public_root, course="a-course")
		self._package(self.public_root, course="z-course")
		real_move = shutil.move

		def move(source, destination):
			if "z-course" in source:
				raise PermissionError(f"{destination}: permission denied")
			return real_move(source, destination)

		with patch.object(relocation.shutil, "move", move), self.assertRaises(frappe.ValidationError):
			self._relocate()

		self.assertTrue(
			os.path.isfile(os.path.join(self.private_root, "a-course", "a-chapter", "index.html"))
		)
		self.assertTrue(os.path.exists(os.path.join(self.public_root, "z-course")))

	def test_symlinks_are_skipped_at_both_levels(self):
		outside = os.path.join(self.site, "elsewhere")
		os.makedirs(os.path.join(outside, "content"))
		os.symlink(outside, os.path.join(self.public_root, "linked-course"))
		os.makedirs(os.path.join(self.public_root, "real-course"))
		os.symlink(outside, os.path.join(self.public_root, "real-course", "linked-chapter"))

		with patch.object(relocation.frappe, "logger") as logger:
			summary = self._relocate()

		self.assertEqual(summary["skipped_symlinks"], 2)
		warning = logger.return_value.warning.call_args.args[0]
		self.assertIn(os.path.join(self.public_root, "linked-course"), warning)
		self.assertIn(os.path.join(self.public_root, "real-course", "linked-chapter"), warning)
		self.assertEqual(summary["moved"], 0)
		self.assertTrue(os.path.isdir(os.path.join(outside, "content")))
		self.assertFalse(os.path.exists(os.path.join(self.private_root, "linked-course")))

	def test_loose_files_are_left_alone(self):
		open(os.path.join(self.public_root, "stray.txt"), "w").close()
		os.makedirs(os.path.join(self.public_root, "a-course"))
		open(os.path.join(self.public_root, "a-course", "stray.html"), "w").close()

		summary = self._relocate()

		self.assertEqual(summary["skipped_files"], 2)
		self.assertTrue(os.path.isfile(os.path.join(self.public_root, "stray.txt")))

	def test_the_emptied_tree_is_pruned_and_nothing_else_under_public_is_touched(self):
		self._package(self.public_root)
		self._relocate()

		self.assertFalse(os.path.exists(self.public_root))
		self.assertTrue(os.path.isfile(os.path.join(self.public_files, "logo.png")))

	def test_a_course_dir_that_still_holds_something_is_kept(self):
		self._package(self.public_root, course="a-course", title="a-chapter")
		open(os.path.join(self.public_root, "a-course", "stray.html"), "w").close()

		self._relocate()

		self.assertTrue(os.path.isdir(os.path.join(self.public_root, "a-course")))
		self.assertTrue(os.path.isfile(os.path.join(self.public_root, "a-course", "stray.html")))


class TestLegacyScormUrls(BaseTestUtils):
	def test_first_release_urls_follow_their_files_to_the_gated_route(self):
		"""Chapters uploaded Nov-Dec 2024 stored /files/scorm/ URLs. Once their files
		move under private/scorm, only /scorm/ serves them."""
		instructor = self._create_user(
			"legacy-scorm-instructor@example.com", "Legacy", "Scorm", ["Course Creator"]
		)
		course = self._create_course(f"Legacy SCORM {frappe.generate_hash(length=6)}", instructor.name)
		chapter = self._create_chapter(None, course.name)
		legacy = f"/files/scorm/{course.name}/intro"
		chapter.db_set(
			{
				"is_scorm_package": 1,
				"scorm_package_path": legacy,
				"manifest_file": f"{legacy}/imsmanifest.xml",
				"launch_file": f"{legacy}/index.html",
			}
		)

		relocation.rewrite_legacy_urls()
		relocation.rewrite_legacy_urls()

		gated = f"/scorm/{course.name}/intro"
		self.assertEqual(
			frappe.db.get_value(
				"Course Chapter", chapter.name, ["scorm_package_path", "manifest_file", "launch_file"]
			),
			(gated, f"{gated}/imsmanifest.xml", f"{gated}/index.html"),
		)
