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
import io
import json
import os
import unittest
import zipfile
from unittest.mock import patch

import frappe

from lms.lms.course_import_export import (
	MAX_IMPORTED_ASSET_BYTES,
	asset_file_url,
	asset_is_private,
	asset_member_path,
	asset_members,
	base_name,
	existing_asset_urls,
	get_asset_citations,
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

	def test_the_archive_json_is_read_once_for_the_asset_citations(self):
		"""The privacy map and the member paths the citations expect come off one
		pass. Read separately, every lesson JSON in the archive is parsed twice."""
		from lms.lms import course_import_export

		with patch.object(
			course_import_export,
			"get_referenced_asset_urls",
			wraps=course_import_export.get_referenced_asset_urls,
		) as citations:
			self._import()

		self.assertEqual(citations.call_count, 1)

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

	def test_a_name_used_by_both_a_public_and_a_private_url_keeps_both(self):
		"""Greptile P1: a course can embed /files/x.png and /private/files/x.png at
		once. Flattened onto one archive entry, the import kept the private one and the
		lesson's public URL was left citing nothing."""
		name = f"dual-{self.hash}.png"
		public_bytes = ONE_PIXEL_PNG + b"public"
		private_bytes = ONE_PIXEL_PNG + b"private"
		path = frappe.get_site_path("private", "files", f"media-privacy-dual-{self.hash}.zip")
		with zipfile.ZipFile(path, "w") as zf:
			zf.writestr(
				"course.json",
				json.dumps(
					{"title": f"Dual Course {self.hash}", "short_introduction": "x", "description": "x"}
				),
			)
			zf.writestr(
				f"chapters/chapter-{self.hash}.json",
				json.dumps({"name": f"dual-ch-{self.hash}", "title": f"Dual Chapter {self.hash}"}),
			)
			zf.writestr(
				f"lessons/lesson-{self.hash}.json",
				json.dumps(
					{
						"title": f"Dual Lesson {self.hash}",
						"chapter": f"dual-ch-{self.hash}",
						"content": json.dumps(
							{
								"blocks": [
									{"type": "upload", "data": {"file_url": f"/files/{name}"}},
									{"type": "upload", "data": {"file_url": f"/private/files/{name}"}},
								]
							}
						),
					}
				),
			)
			zf.writestr(f"assets/files/{name}", public_bytes)
			zf.writestr(f"assets/private/files/{name}", private_bytes)
		self.addCleanup(lambda: os.path.exists(path) and os.remove(path))

		original = frappe.session.user
		frappe.set_user(self.importer)
		try:
			import_course_zip(f"/private/files/{os.path.basename(path)}")
		finally:
			frappe.set_user(original)

		for url, is_private, size in (
			(f"/files/{name}", 0, len(public_bytes)),
			(f"/private/files/{name}", 1, len(private_bytes)),
		):
			with self.subTest(url=url):
				row = frappe.db.get_value(
					"File", {"file_url": url}, ["is_private", "file_size"], as_dict=True
				)
				self.assertTrue(row, f"the lesson cites {url} and nothing serves it")
				self.assertEqual(row.is_private, is_private)
				# The bytes filed under each root, not one blob copied to both URLs.
				self.assertEqual(row.file_size, size)

	def test_a_root_that_contradicts_the_only_citation_does_not_publish_it(self):
		"""Greptile P1: the archive stores this name under assets/files/ (public) but
		the lesson only ever cites it at /private/files/. The path must not overrule
		the citation, or bytes the content asked to keep private get published."""
		name = f"mismatch-{self.hash}.png"
		content_bytes = ONE_PIXEL_PNG + b"mismatch"
		path = frappe.get_site_path("private", "files", f"media-privacy-mismatch-{self.hash}.zip")
		with zipfile.ZipFile(path, "w") as zf:
			zf.writestr(
				"course.json",
				json.dumps(
					{"title": f"Mismatch Course {self.hash}", "short_introduction": "x", "description": "x"}
				),
			)
			zf.writestr(
				f"chapters/chapter-{self.hash}.json",
				json.dumps({"name": f"mismatch-ch-{self.hash}", "title": f"Mismatch Chapter {self.hash}"}),
			)
			zf.writestr(
				f"lessons/lesson-{self.hash}.json",
				json.dumps(
					{
						"title": f"Mismatch Lesson {self.hash}",
						"chapter": f"mismatch-ch-{self.hash}",
						"content": json.dumps(
							{"blocks": [{"type": "upload", "data": {"file_url": f"/private/files/{name}"}}]}
						),
					}
				),
			)
			zf.writestr(f"assets/files/{name}", content_bytes)
		self.addCleanup(lambda: os.path.exists(path) and os.remove(path))

		original = frappe.session.user
		frappe.set_user(self.importer)
		try:
			import_course_zip(f"/private/files/{os.path.basename(path)}")
		finally:
			frappe.set_user(original)

		self.assertFalse(
			frappe.db.exists("File", {"file_url": f"/files/{name}"}),
			"the mismatched root published bytes the lesson cites as private",
		)
		row = frappe.db.get_value(
			"File", {"file_url": f"/private/files/{name}"}, ["is_private", "file_size"], as_dict=True
		)
		self.assertTrue(row, f"the lesson cites /private/files/{name} and nothing serves it")
		self.assertEqual(row.is_private, 1)
		self.assertEqual(row.file_size, len(content_bytes))

	def test_two_members_resolving_to_the_same_url_do_not_create_an_orphan(self):
		"""Greptile P1: assets/x.png and assets/files/x.png both resolve to
		/files/x.png. Undeduped, the second insert finds the URL taken and frappe
		renames it into an orphan File nothing cites."""
		name = f"collide-{self.hash}.png"
		first_bytes = ONE_PIXEL_PNG + b"first"
		second_bytes = ONE_PIXEL_PNG + b"second"
		path = frappe.get_site_path("private", "files", f"media-privacy-collide-{self.hash}.zip")
		with zipfile.ZipFile(path, "w") as zf:
			zf.writestr(
				"course.json",
				json.dumps(
					{"title": f"Collide Course {self.hash}", "short_introduction": "x", "description": "x"}
				),
			)
			zf.writestr(
				f"chapters/chapter-{self.hash}.json",
				json.dumps({"name": f"collide-ch-{self.hash}", "title": f"Collide Chapter {self.hash}"}),
			)
			zf.writestr(
				f"lessons/lesson-{self.hash}.json",
				json.dumps(
					{
						"title": f"Collide Lesson {self.hash}",
						"chapter": f"collide-ch-{self.hash}",
						"content": json.dumps(
							{"blocks": [{"type": "upload", "data": {"file_url": f"/files/{name}"}}]}
						),
					}
				),
			)
			zf.writestr(f"assets/{name}", first_bytes)
			zf.writestr(f"assets/files/{name}", second_bytes)
		self.addCleanup(lambda: os.path.exists(path) and os.remove(path))

		original = frappe.session.user
		frappe.set_user(self.importer)
		try:
			import_course_zip(f"/private/files/{os.path.basename(path)}")
		finally:
			frappe.set_user(original)

		rows = frappe.get_all(
			"File", filters={"file_url": ("like", f"%{name}%")}, fields=["name", "file_url", "file_size"]
		)
		self.assertEqual(len(rows), 1, f"two members resolving to one URL created {len(rows)} rows: {rows}")
		self.assertEqual(rows[0].file_url, f"/files/{name}")
		# The correctly rooted, citation-confirmed member wins over the flat, legacy
		# one ahead of it in the archive, not whichever the zip lists first.
		self.assertEqual(rows[0].file_size, len(second_bytes))

	def test_a_private_rooted_member_never_wins_a_mismatched_public_citation(self):
		"""Greptile round 3: the lesson cites only /files/{name}, and the archive
		also carries a private-rooted member for that name. Either zip order, that
		member's bytes must land at its own private URL, never the public one."""
		for order_label, members in (
			("flat first", ("assets/{name}", "assets/private/files/{name}")),
			("private root first", ("assets/private/files/{name}", "assets/{name}")),
		):
			with self.subTest(order=order_label):
				name = f"root3-{order_label.replace(' ', '-')}-{self.hash}.png"
				# Distinct per subTest: identical bytes elsewhere would hit frappe's
				# content-hash dedup and repoint this file_url to that other File.
				flat_bytes = ONE_PIXEL_PNG + f"flat-{name}".encode()
				private_bytes = ONE_PIXEL_PNG + f"private-rooted-{name}".encode()
				bytes_by_member = {"assets/{name}": flat_bytes, "assets/private/files/{name}": private_bytes}
				path = frappe.get_site_path("private", "files", f"media-privacy-root3-{name}.zip")
				with zipfile.ZipFile(path, "w") as zf:
					zf.writestr(
						"course.json",
						json.dumps({"title": f"Root3 {name}", "short_introduction": "x", "description": "x"}),
					)
					zf.writestr(
						f"chapters/chapter-{name}.json",
						json.dumps({"name": f"ch-{name}", "title": f"Root3 Chapter {name}"}),
					)
					zf.writestr(
						f"lessons/lesson-{name}.json",
						json.dumps(
							{
								"title": f"Root3 Lesson {name}",
								"chapter": f"ch-{name}",
								"content": json.dumps(
									{"blocks": [{"type": "upload", "data": {"file_url": f"/files/{name}"}}]}
								),
							}
						),
					)
					for template in members:
						zf.writestr(template.format(name=name), bytes_by_member[template])
				self.addCleanup(lambda p=path: os.path.exists(p) and os.remove(p))

				original = frappe.session.user
				frappe.set_user(self.importer)
				try:
					import_course_zip(f"/private/files/{os.path.basename(path)}")
				finally:
					frappe.set_user(original)

				public_row = frappe.db.get_value(
					"File", {"file_url": f"/files/{name}"}, ["is_private", "file_size"], as_dict=True
				)
				self.assertTrue(public_row, f"the lesson cites /files/{name} and nothing serves it")
				self.assertEqual(public_row.is_private, 0)
				self.assertEqual(
					public_row.file_size, len(flat_bytes), "the private-rooted bytes were published public"
				)

				private_row = frappe.db.get_value(
					"File", {"file_url": f"/private/files/{name}"}, ["is_private", "file_size"], as_dict=True
				)
				self.assertTrue(private_row, "the private-rooted member was dropped instead of kept private")
				self.assertEqual(private_row.is_private, 1)
				self.assertEqual(private_row.file_size, len(private_bytes))

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


class TestAssetPrivacyIsNotFlattened(unittest.TestCase):
	"""Greptile P1. /files/x.png and /private/files/x.png are two files on a site, and
	a course can embed both. The archive has to keep them apart or the import loses one
	of them and the URL that cited it serves nothing. Fixture-free: archive bookkeeping.
	"""

	def _archive(self, *members):
		buffer = io.BytesIO()
		with zipfile.ZipFile(buffer, "w") as zf:
			for name in members:
				zf.writestr(name, ONE_PIXEL_PNG)
		return zipfile.ZipFile(buffer)

	def _imported_urls(self, zip_file):
		"""The File URLs create_assets would end up asking for."""
		privacy, referenced_paths = get_asset_citations(zip_file)
		return {
			asset_file_url(base_name(info.filename), is_private)
			for info, is_private in asset_members(zip_file, privacy, referenced_paths)
		}

	def test_the_export_files_public_and_private_assets_under_their_own_root(self):
		self.assertEqual(asset_member_path("/files/logo.png"), "assets/files/logo.png")
		self.assertEqual(asset_member_path("/private/files/logo.png"), "assets/private/files/logo.png")

	def test_a_name_under_both_roots_survives_as_two_members(self):
		"""Both cited, so each member's own root is confirmed and neither collapses
		into the other."""
		archive = self._archive("assets/files/x.png", "assets/private/files/x.png")
		referenced_paths = {"assets/files/x.png", "assets/private/files/x.png"}
		members = asset_members(archive, {}, referenced_paths)
		self.assertEqual(
			[info.filename for info, _ in members],
			["assets/files/x.png", "assets/private/files/x.png"],
		)
		urls = {asset_file_url(base_name(info.filename), is_private) for info, is_private in members}
		self.assertEqual(urls, {"/files/x.png", "/private/files/x.png"})

	def test_an_uncited_asset_defaults_to_private_even_under_the_public_root(self):
		"""Greptile round 2: nothing cites this asset anywhere, so its own root must
		not be enough to publish it -- an uncited file has no one to vouch for it."""
		self.assertEqual(asset_is_private({}, "assets/files/x.png", set()), 1)

	def test_an_uncited_pair_under_both_roots_collapses_to_one_private_file(self):
		"""Companion to the above at the asset_members level: with no citation for
		either root, both default private, resolve to the same URL, and dedup keeps
		one member rather than publishing the public-rooted one."""
		archive = self._archive("assets/files/x.png", "assets/private/files/x.png")
		members = asset_members(archive, {}, set())
		self.assertEqual(len(members), 1)
		self.assertEqual(members[0][1], 1)

	def test_a_confirmed_root_wins_even_when_a_sibling_citation_says_otherwise(self):
		"""The dual case: /files/x.png and /private/files/x.png are both cited, so
		each member's own root exactly matches one of them and keeps its own privacy
		rather than collapsing to the other."""
		referenced_paths = {"assets/files/x.png", "assets/private/files/x.png"}
		self.assertEqual(asset_is_private({"x.png": 1}, "assets/files/x.png", referenced_paths), 0)
		self.assertEqual(asset_is_private({"x.png": 1}, "assets/private/files/x.png", referenced_paths), 1)

	def test_asset_is_private_covers_every_citation_and_root_combination(self):
		"""Every (citation privacy x member root) cell (Greptile P1, round 3). A
		private root is never eligible for a public URL; a public root deferring
		to a private citation leaks nothing, so it is left to defer."""
		cases = (
			# label, privacy, member, referenced_paths, expected
			("public root, uncited", {}, "assets/files/x.png", set(), 1),
			("public root, unconfirmed public derived", {"x.png": 0}, "assets/files/x.png", set(), 0),
			(
				"public root, confirmed public",
				{"x.png": 0},
				"assets/files/x.png",
				{"assets/files/x.png"},
				0,
			),
			("public root, unconfirmed private derived", {"x.png": 1}, "assets/files/x.png", set(), 1),
			(
				"public root, confirmed amid a dual citation",
				{"x.png": 1},
				"assets/files/x.png",
				{"assets/files/x.png", "assets/private/files/x.png"},
				0,
			),
			("private root, uncited", {}, "assets/private/files/x.png", set(), 1),
			(
				"private root, confirmed private",
				{"x.png": 1},
				"assets/private/files/x.png",
				{"assets/private/files/x.png"},
				1,
			),
			(
				"private root, unconfirmed public derived (round 3 bug)",
				{"x.png": 0},
				"assets/private/files/x.png",
				set(),
				1,
			),
			(
				"private root, confirmed amid a dual citation",
				{"x.png": 1},
				"assets/private/files/x.png",
				{"assets/files/x.png", "assets/private/files/x.png"},
				1,
			),
			("flat, uncited", {}, "assets/x.png", set(), 1),
			("flat, public derived", {"x.png": 0}, "assets/x.png", set(), 0),
			("flat, private derived", {"x.png": 1}, "assets/x.png", set(), 1),
		)
		for label, privacy, member, referenced_paths, expected in cases:
			with self.subTest(label=label):
				self.assertEqual(asset_is_private(privacy, member, referenced_paths), expected)

	def test_a_flat_archive_still_reads_privacy_off_the_citing_url(self):
		"""Control. Archives exported before the split record nothing in the path, so
		those still take the citing URL's privacy and default to private."""
		self.assertEqual(asset_is_private({"x.png": 0}, "assets/x.png", set()), 0)
		self.assertEqual(asset_is_private({"x.png": 1}, "assets/x.png", set()), 1)
		self.assertEqual(asset_is_private({}, "assets/x.png", set()), 1)

	def test_a_flat_archive_still_reduces_a_name_to_one_member(self):
		"""Control for the fix. One flat entry cannot say which of two same-named files
		it holds, so it must stay one asset, and private."""
		members = asset_members(self._archive("assets/a/x.png", "assets/b/x.png"), {}, set())
		self.assertEqual([info.filename for info, _ in members], ["assets/a/x.png"])
		self.assertEqual(self._imported_urls(self._archive("assets/x.png")), {"/private/files/x.png"})

	def test_priority_winner_is_independent_of_zip_order(self):
		"""Greptile round 2: a legacy flat member must not win a destination URL
		over a citation-confirmed rooted one, regardless of which one is listed
		first in the archive."""
		flat, rooted = "assets/x.png", "assets/files/x.png"
		for label, order in (("flat first", (flat, rooted)), ("rooted first", (rooted, flat))):
			with self.subTest(label=label):
				members = asset_members(self._archive(*order), {"x.png": 0}, {rooted})
				self.assertEqual([info.filename for info, _ in members], [rooted])

	def test_a_genuine_priority_tie_is_settled_by_zip_order(self):
		"""Two uncited rooted members of opposite privacy tie at priority 1 (neither
		is citation-confirmed). Documents that a real tie, unlike a ranked case
		above, is settled by list order rather than one root outranking the other."""
		public_root, private_root = "assets/files/x.png", "assets/private/files/x.png"
		for label, order in (
			("public root first", (public_root, private_root)),
			("private root first", (private_root, public_root)),
		):
			with self.subTest(label=label):
				members = asset_members(self._archive(*order), {}, set())
				self.assertEqual([info.filename for info, _ in members], [order[0]])
