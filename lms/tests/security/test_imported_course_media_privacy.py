# Copyright (c) 2026, FOSS United and Contributors
# See license.txt
"""An imported course's media must arrive private and reachable.

Regression tests for frappe/lms#2768.

`create_asset_doc` set no `is_private`, and `File.set_is_private` only infers privacy
from `file_url` -- which a content-only row does not have yet -- so an imported asset
would have landed public: an export/import round trip laundered a `/private/files/`
lesson image into a `/files/` one. It never got that far in practice, because
`process_asset_file` guarded the archive member name with `is_safe_path`, a filesystem
containment check that resolves against the process working directory and so rejected
every member it was ever given. Imported courses simply arrived with no media at all.
"""

import base64
import json
import os
import unittest
import zipfile
from unittest.mock import patch

import frappe

from lms.lms.course_import_export import (
	MAX_IMPORTED_ASSET_BYTES,
	asset_file_url,
	existing_asset_urls,
	import_course_zip,
	is_safe_zip_member,
	validate_assets,
)
from lms.lms.permissions import courses_authored_by
from lms.lms.test_helpers import BaseTestUtils

# 1x1 transparent PNG.
ONE_PIXEL_PNG = base64.b64decode(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC"
)


class TestImportedCourseMediaPrivacy(BaseTestUtils):
	"""An imported asset keeps the privacy of the URL that referenced it, and the
	importer authors the imported course so `serve_resource` will vouch for it."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6).lower()
		cls.hash = hash
		cls.importer = cls._create_user(
			f"mp-importer-{hash}@example.com", "Im", "Porter", ["Course Creator"]
		).name
		cls.listed_author = cls._create_user(
			f"mp-author-{hash}@example.com", "Au", "Thor", ["Course Creator"]
		).name
		cls.private_asset = f"secret-{hash}.png"
		cls.public_asset = f"banner-{hash}.png"

	def _build_zip(self):
		"""A course whose lesson embeds one private and one public asset."""
		private_asset, public_asset = self.private_asset, self.public_asset
		content = json.dumps(
			{
				"blocks": [
					{"type": "upload", "data": {"file_url": f"/private/files/{private_asset}"}},
					{"type": "upload", "data": {"file_url": f"/files/{public_asset}"}},
				]
			}
		)
		path = frappe.get_site_path("private", "files", f"media-privacy-{self.hash}.zip")
		with zipfile.ZipFile(path, "w") as zf:
			zf.writestr(
				"course.json",
				json.dumps(
					{
						"title": f"Imported Media Course {self.hash}",
						"short_introduction": "x",
						"description": "x",
						"instructors": [{"instructor": self.listed_author}],
					}
				),
			)
			zf.writestr(
				f"chapters/chapter-{self.hash}.json",
				json.dumps({"name": f"ch-{self.hash}", "title": f"Imported Chapter {self.hash}"}),
			)
			zf.writestr(
				f"lessons/lesson-{self.hash}.json",
				json.dumps(
					{
						"title": f"Imported Lesson {self.hash}",
						"chapter": f"ch-{self.hash}",
						"content": content,
					}
				),
			)
			zf.writestr(f"assets/{private_asset}", ONE_PIXEL_PNG)
			zf.writestr(f"assets/{public_asset}", ONE_PIXEL_PNG)
		self.addCleanup(lambda: os.path.exists(path) and os.remove(path))
		return f"/private/files/{os.path.basename(path)}", private_asset, public_asset

	def _import(self):
		zip_path, private_asset, public_asset = self._build_zip()
		original = frappe.session.user
		frappe.set_user(self.importer)
		try:
			course = import_course_zip(zip_path)
		finally:
			frappe.set_user(original)
		return course, private_asset, public_asset

	def test_an_asset_referenced_by_a_private_url_is_recreated_private(self):
		_, private_asset, _ = self._import()
		row = frappe.db.get_value(
			"File", {"file_name": private_asset}, ["is_private", "file_url"], as_dict=True
		)
		self.assertTrue(row, f"no File row for {private_asset}")
		self.assertEqual(row.is_private, 1)
		self.assertEqual(row.file_url, f"/private/files/{private_asset}")

	def test_an_asset_referenced_by_a_public_url_stays_public(self):
		"""Control. Blanket-private would break the course image and instructor
		avatars, which the lesson content references at /files/ and which would then
		point at nothing."""
		_, _, public_asset = self._import()
		row = frappe.db.get_value(
			"File", {"file_name": public_asset}, ["is_private", "file_url"], as_dict=True
		)
		self.assertTrue(row, f"no File row for {public_asset}")
		self.assertEqual(row.is_private, 0)
		self.assertEqual(row.file_url, f"/files/{public_asset}")

	def test_the_importer_authors_the_imported_course(self):
		"""serve_resource only honours a lesson whose course the file's OWNER authors,
		and every imported asset is owned by whoever ran the import. Without this the
		private assets above are dead to the importer, the students and the guests."""
		course, _, _ = self._import()
		self.assertEqual(courses_authored_by(self.importer, [course]), {course})

	def test_an_archive_carrying_an_active_document_asset_is_refused_end_to_end(self):
		"""Wiring: validate_assets is unit-tested below, this proves import_course_zip
		actually reaches it."""
		path = frappe.get_site_path("private", "files", f"media-privacy-xss-{self.hash}.zip")
		with zipfile.ZipFile(path, "w") as zf:
			zf.writestr(
				"course.json",
				json.dumps(
					{"title": f"XSS Course {self.hash}", "short_introduction": "x", "description": "x"}
				),
			)
			zf.writestr(f"assets/payload-{self.hash}.html", b"<script>alert(1)</script>")
		self.addCleanup(lambda: os.path.exists(path) and os.remove(path))

		original = frappe.session.user
		frappe.set_user(self.importer)
		try:
			with self.assertRaises(frappe.ValidationError):
				import_course_zip(f"/private/files/{os.path.basename(path)}")
		finally:
			frappe.set_user(original)

		self.assertFalse(frappe.db.exists("File", {"file_name": f"payload-{self.hash}.html"}))

	def test_the_existence_probe_runs_once_for_the_whole_archive(self):
		"""Greptile P2 on frappe/lms#2768: create_asset_doc ran db.exists once per
		archive member, a query per asset at request time."""
		from lms.lms import course_import_export

		with patch.object(
			course_import_export,
			"existing_asset_urls",
			wraps=course_import_export.existing_asset_urls,
		) as probe:
			self._import()

		self.assertEqual(probe.call_count, 1)

	def test_a_public_file_of_that_name_does_not_block_the_private_asset(self):
		"""Regression from frappe/lms#2768's own privacy change, caught reviewing that
		PR. Private and public are two directories. A site already holding a public
		secret.png made the name-keyed check skip the imported private one, leaving
		the lesson citing /private/files/secret.png, which nothing serves."""
		squatter = frappe.new_doc("File")
		squatter.file_name = self.private_asset
		squatter.content = ONE_PIXEL_PNG + b"squatter"
		squatter.is_private = 0
		squatter.insert()
		self.assertEqual(squatter.file_url, f"/files/{self.private_asset}")

		self._import()

		self.assertTrue(
			frappe.db.exists("File", {"file_url": f"/private/files/{self.private_asset}"}),
			"the public file of that name swallowed the private asset",
		)

	def test_two_archive_paths_sharing_a_file_name_create_one_asset(self):
		"""Greptile P1 on frappe/lms#2768. assets/a/x.png and assets/b/x.png reduce to
		one file name. The pre-loop existence snapshot cannot see the first insert, so
		hoisting it out of the loop would have let the second one through."""
		name = f"dup-{self.hash}.png"
		path = frappe.get_site_path("private", "files", f"media-privacy-dup-{self.hash}.zip")
		with zipfile.ZipFile(path, "w") as zf:
			zf.writestr(
				"course.json",
				json.dumps(
					{"title": f"Dup Course {self.hash}", "short_introduction": "x", "description": "x"}
				),
			)
			zf.writestr(f"assets/a/{name}", ONE_PIXEL_PNG)
			zf.writestr(f"assets/b/{name}", ONE_PIXEL_PNG + b"second")
		self.addCleanup(lambda: os.path.exists(path) and os.remove(path))

		original = frappe.session.user
		frappe.set_user(self.importer)
		try:
			import_course_zip(f"/private/files/{os.path.basename(path)}")
		finally:
			frappe.set_user(original)

		# Matched on the URL stem, not file_name: frappe renames a colliding upload, so
		# the second row is filed under dup-<hash><suffix>.png and a file_name query
		# cannot see it.
		rows = frappe.get_all(
			"File", filters={"file_url": ("like", f"%dup-{self.hash}%")}, fields=["name", "file_url"]
		)
		self.assertEqual(len(rows), 1, f"one file name, {len(rows)} File rows: {rows}")

	def test_a_traversing_member_does_not_shadow_the_valid_one(self):
		"""Greptile P2 on frappe/lms#2768. Deduplicating by base name before the
		traversal check let assets/../x.png claim the name and then be rejected, so the
		real assets/x.png was dropped and the course imported without its media."""
		name = f"shadow-{self.hash}.png"
		valid_bytes = ONE_PIXEL_PNG + b"valid"
		path = frappe.get_site_path("private", "files", f"media-privacy-shadow-{self.hash}.zip")
		with zipfile.ZipFile(path, "w") as zf:
			zf.writestr(
				"course.json",
				json.dumps(
					{"title": f"Shadow Course {self.hash}", "short_introduction": "x", "description": "x"}
				),
			)
			zf.writestr(f"assets/../{name}", b"traversing")
			zf.writestr(f"assets/{name}", valid_bytes)
		self.addCleanup(lambda: os.path.exists(path) and os.remove(path))

		original = frappe.session.user
		frappe.set_user(self.importer)
		try:
			import_course_zip(f"/private/files/{os.path.basename(path)}")
		finally:
			frappe.set_user(original)

		rows = frappe.get_all("File", filters={"file_name": name}, fields=["name", "file_size"], limit=2)
		self.assertEqual(len(rows), 1, f"expected the valid member alone, got {rows}")
		self.assertEqual(rows[0].file_size, len(valid_bytes))

	def test_the_existence_check_is_a_locking_read_on_the_url(self):
		"""Greptile P1 on frappe/lms#2768: check-then-insert with no lock, so two
		concurrent imports both read the URL as free and both create the asset.

		Asserted on the SQL because this runner holds one transaction for the whole
		run, and a test that really took the lock would stall every later File insert
		in its range. Verified by hand against a second connection instead.
		"""
		with patch.object(frappe.db, "sql", return_value=[]) as spy:
			existing_asset_urls({"/private/files/lock-probe.png"})

		sql = str(spy.call_args[0][0]).lower()
		self.assertIn("for update", sql)
		self.assertIn("file_url", sql)
		self.assertNotIn("file_name", sql)

	def test_the_asset_url_is_the_one_the_lesson_cites(self):
		"""The key existing_asset_urls matches on. Added reviewing frappe/lms#2768."""
		for name, is_private, expected in (
			("logo.png", 1, "/private/files/logo.png"),
			("logo.png", 0, "/files/logo.png"),
			# frappe rewrites these before deriving the URL; predicting the raw name
			# would look for an asset at a URL the site never serves.
			("a#b?c.png", 0, "/files/a_b_c.png"),
		):
			with self.subTest(name=name, is_private=is_private):
				self.assertEqual(asset_file_url(name, is_private), expected)

	def test_the_listed_instructor_is_still_carried_over(self):
		course, _, _ = self._import()
		instructors = frappe.get_all(
			"Course Instructor",
			filters={"parent": course, "parenttype": "LMS Course"},
			pluck="instructor",
		)
		self.assertIn(self.listed_author, instructors)


class TestZipMemberGuard(unittest.TestCase):
	"""The guard that replaced `is_safe_path`. Fixture-free: it judges a name."""

	def test_it_rejects_absolute_or_traversing_member_names(self):
		for name in (
			"",
			"..",
			"/etc/passwd",
			"../../etc/passwd",
			"assets/../../../etc/passwd",
			"assets/./../../etc/passwd",
			"assets/",
			"assets//logo.png",
			"assets\\logo.png",
		):
			with self.subTest(name=name):
				self.assertFalse(is_safe_zip_member(name))

	def test_it_accepts_the_names_an_exported_course_actually_uses(self):
		"""Control: the old guard rejected these too, which is why no asset was
		ever created."""
		for name in ("course.json", "assets/logo.png", "assets/nested/logo.png"):
			with self.subTest(name=name):
				self.assertTrue(is_safe_zip_member(name))


class TestImportedAssetBounds(unittest.TestCase):
	"""frappe/lms#2768. Enabling the asset path (it had been dead) let an uploaded
	archive write attacker-chosen bytes to disk for the first time, so it is bounded
	here rather than by the archive."""

	def _member(self, filename, size=1):
		info = zipfile.ZipInfo(filename)
		info.file_size = size
		return info

	def test_it_refuses_an_active_document_asset(self):
		"""A public /files/payload.html is stored XSS on the LMS origin. SVG counts:
		it carries script."""
		for filename in (
			"assets/payload.html",
			"assets/payload.xhtml",
			"assets/payload.js",
			"assets/payload.svg",
			"assets/payload",
		):
			with self.subTest(filename=filename):
				with self.assertRaises(frappe.ValidationError):
					validate_assets([self._member(filename)])

	def test_it_accepts_the_media_a_course_embeds(self):
		validate_assets([self._member(f"assets/x{ext}") for ext in (".png", ".jpg", ".mp4", ".mp3", ".pdf")])

	def test_it_refuses_an_archive_that_declares_more_than_the_cap(self):
		"""Declared sizes, so a highly compressible archive is turned away before any
		member is read."""
		with self.assertRaises(frappe.ValidationError):
			validate_assets([self._member("assets/big.png", MAX_IMPORTED_ASSET_BYTES + 1)])
