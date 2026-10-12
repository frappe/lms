# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""A chapter's SCORM path must not let a course writer rmtree anything but that chapter's package.

Deletion runs against a temp site path since the code under test used to resolve
an empty or ambiguous stored path to the site's public/ root and delete it.
"""

import json
import os
import shutil
import tempfile
import zipfile

import frappe

from lms.lms.api import (
	_scorm_extract_path,
	_scorm_package_dir,
	_scorm_url,
	delete_chapter,
	upsert_chapter,
)
from lms.lms.course_import_export import import_course_zip
from lms.lms.test_helpers import BaseTestUtils

SCORM_FIELDS = ("is_scorm_package", "scorm_package", "scorm_package_path", "manifest_file", "launch_file")


class TestImportedChapterScormFields(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.hash = frappe.generate_hash(length=6).lower()
		self.importer = self._create_user(
			f"spc-importer-{self.hash}@example.com", "Im", "Porter", ["Course Creator"]
		).name
		self.package = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": f"spc-{self.hash}.zip",
				"is_private": 1,
				"content": "not a real package",
			}
		).insert()

	def _build_zip(self, chapter):
		path = frappe.get_site_path("private", "files", f"spc-{self.hash}.zip")
		with zipfile.ZipFile(path, "w") as zf:
			zf.writestr(
				"course.json",
				json.dumps(
					{"title": f"SCORM Path Import {self.hash}", "short_introduction": "x", "description": "x"}
				),
			)
			zf.writestr(f"chapters/chapter-{self.hash}.json", json.dumps(chapter))
		self.addCleanup(lambda: os.path.exists(path) and os.remove(path))
		return f"/private/files/{os.path.basename(path)}"

	def test_an_imported_chapter_carries_no_scorm_fields(self):
		zip_path = self._build_zip(
			{
				"name": f"ch-{self.hash}",
				"title": f"Imported Chapter {self.hash}",
				"is_scorm_package": 1,
				"scorm_package": self.package.name,
				"scorm_package_path": "/scorm/someone-elses-course/their-chapter",
				"manifest_file": "/scorm/someone-elses-course/their-chapter/imsmanifest.xml",
				"launch_file": "/scorm/someone-elses-course/their-chapter/index.html",
			}
		)
		frappe.set_user(self.importer)
		course = import_course_zip(zip_path)
		frappe.set_user("Administrator")

		stored = frappe.db.get_value("Course Chapter", {"course": course}, SCORM_FIELDS, as_dict=True)
		self.assertEqual(
			{field: stored[field] or None for field in SCORM_FIELDS}, dict.fromkeys(SCORM_FIELDS)
		)


class TestScormPackageDeletion(BaseTestUtils):
	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6).lower()
		self.creator = self._create_user(f"spc-c-{hash}@example.com", "Cara", "Creator", ["Course Creator"])
		self.course = self._create_course(title=f"SCORM Path Delete {hash}", instructor=self.creator.name)

		self._tmp = tempfile.TemporaryDirectory()
		self._real_site_path = frappe.local.site_path
		frappe.local.site_path = self._tmp.name
		self.public_files = os.path.join(self._tmp.name, "public", "files")
		os.makedirs(self.public_files)
		with open(os.path.join(self.public_files, "logo.png"), "w") as f:
			f.write("canary")

	def tearDown(self):
		frappe.local.site_path = self._real_site_path
		self._tmp.cleanup()
		super().tearDown()

	def _package(self, root, course, title):
		path = os.path.join(self._tmp.name, root, "scorm", course, title)
		os.makedirs(path)
		with open(os.path.join(path, "index.html"), "w") as f:
			f.write("<html></html>")
		return path

	def _scorm_chapter(self, title, scorm_package_path):
		chapter = self._create_chapter(title, self.course.name)
		frappe.db.set_value(
			"Course Chapter", chapter.name, {"is_scorm_package": 1, "scorm_package_path": scorm_package_path}
		)
		return chapter.name

	def _delete_as_creator(self, chapter):
		frappe.set_user(self.creator.name)
		delete_chapter(chapter)
		frappe.set_user("Administrator")

	def _assert_canary_intact(self):
		self.assertTrue(os.path.isfile(os.path.join(self.public_files, "logo.png")))

	def test_the_chapters_own_package_is_deleted_from_private(self):
		path = self._package("private", self.course.name, "Own")
		self._delete_as_creator(self._scorm_chapter("Own", f"/scorm/{self.course.name}/Own"))
		self.assertFalse(os.path.exists(path))

	def test_a_legacy_package_under_public_is_deleted(self):
		path = self._package("public", self.course.name, "Legacy")
		self._delete_as_creator(self._scorm_chapter("Legacy", f"/scorm/{self.course.name}/Legacy"))
		self.assertFalse(os.path.exists(path))

	def _assert_packages_intact(self, paths):
		for path in paths:
			self.assertTrue(os.path.isfile(os.path.join(path, "index.html")), path)

	def test_another_courses_package_survives(self):
		theirs = [self._package(root, "someone-elses-course", "theirs") for root in ("private", "public")]
		self._delete_as_creator(self._scorm_chapter("Pointed", "/scorm/someone-elses-course/theirs"))
		self._assert_packages_intact(theirs)

	def test_a_package_another_chapter_still_uses_survives(self):
		shared = [self._package(root, self.course.name, "Shared") for root in ("private", "public")]
		stored = f"/scorm/{self.course.name}/Shared"
		self._scorm_chapter("Keeper", stored)
		self._delete_as_creator(self._scorm_chapter("Leaver", stored))
		self._assert_packages_intact(shared)

	def test_a_traversing_path_deletes_nothing(self):
		for root in ("private", "public"):
			self._package(root, self.course.name, "Real")
		self._delete_as_creator(self._scorm_chapter("Traversal", f"/scorm/{self.course.name}/../../files"))
		self._assert_canary_intact()

	def test_an_empty_path_does_not_wipe_the_public_tree(self):
		self._delete_as_creator(self._scorm_chapter("Empty", ""))
		self._assert_canary_intact()

	def test_a_symlinked_package_directory_is_left_alone(self):
		for root in ("private", "public"):
			course_dir = os.path.join(self._tmp.name, root, "scorm", self.course.name)
			os.makedirs(course_dir)
			os.symlink(self.public_files, os.path.join(course_dir, "Linked"))
		self._delete_as_creator(self._scorm_chapter("Linked", f"/scorm/{self.course.name}/Linked"))
		self._assert_canary_intact()

	def test_a_non_string_chapter_is_rejected_by_the_endpoint(self):
		with self.assertRaises(frappe.FrappeTypeError):
			delete_chapter(["not", "a", "name"])

	def test_a_non_string_chapter_is_rejected_by_the_body(self):
		# The whitelist wrapper coerces first, so only __wrapped__ reaches the guard.
		with self.assertRaises(frappe.ValidationError):
			delete_chapter.__wrapped__(["not", "a", "name"])

	def test_a_dot_segment_variant_of_a_shared_path_survives(self):
		shared = [self._package(root, self.course.name, "Shared") for root in ("private", "public")]
		self._scorm_chapter("Keeper", f"/scorm/{self.course.name}/./Shared")
		self._delete_as_creator(self._scorm_chapter("Leaver", f"/scorm/{self.course.name}/Shared"))
		self._assert_packages_intact(shared)


class TestScormExtractionStaysOneSegmentDeep(BaseTestUtils):
	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6).lower()
		instructor = self._create_user(f"spc-e-{hash}@example.com", "Eva", "Extract", ["Course Creator"])
		self.course = self._create_course(title=f"SCORM Extract Path {hash}", instructor=instructor.name)

	def test_a_slash_in_the_title_does_not_nest_the_extraction(self):
		extract_path = _scorm_extract_path(self.course.name, "Module/Intro")
		stored = _scorm_url(extract_path)
		self.assertIsNotNone(_scorm_package_dir("private", self.course.name, stored))


class TestScormExtractionDirIsUniquePerChapter(BaseTestUtils):
	"""Two titles that sanitise to the same segment ("Module/Intro" vs "Module-Intro")
	must still get separate extraction dirs, or the second upload deletes the first
	chapter's files. upsert_chapter keys extraction off the chapter's own docname."""

	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6).lower()
		self.instructor = self._create_user(f"spc-k-{hash}@example.com", "Kai", "Keyed", ["Course Creator"])
		self.course = self._create_course(
			title=f"SCORM Keyed Extract {hash}", instructor=self.instructor.name
		)

		self._tmp = tempfile.mkdtemp()
		self.addCleanup(shutil.rmtree, self._tmp, True)
		zip_path = os.path.join(self._tmp, "pkg.zip")
		with zipfile.ZipFile(zip_path, "w") as zf:
			zf.writestr("index.html", "<html>ok</html>")
			zf.writestr(
				"imsmanifest.xml",
				'<?xml version="1.0"?>'
				'<manifest xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">'
				'<resource adlcp:scormtype="sco" href="index.html"/></manifest>',
			)
		with open(zip_path, "rb") as f:
			self.package = frappe.get_doc(
				{"doctype": "File", "file_name": f"spc-k-{hash}.zip", "is_private": 1, "content": f.read()}
			).insert()

		course_scorm_dir = os.path.join(
			os.path.realpath(frappe.get_site_path("private", "scorm")), self.course.name
		)
		self.addCleanup(shutil.rmtree, course_scorm_dir, True)

	def _upsert(self, title):
		frappe.set_user(self.instructor.name)
		chapter = upsert_chapter(title, self.course.name, True, {"name": self.package.name})
		frappe.set_user("Administrator")
		return chapter

	def test_colliding_titles_get_different_extraction_dirs(self):
		first = self._upsert("Module/Intro")
		second = self._upsert("Module-Intro")
		self.assertNotEqual(first.scorm_package_path, second.scorm_package_path)

	def test_deleting_one_colliding_chapter_leaves_the_others_files(self):
		first = self._upsert("Module/Intro")
		second = self._upsert("Module-Intro")

		frappe.set_user(self.instructor.name)
		delete_chapter(second.name)
		frappe.set_user("Administrator")

		first_dir = frappe.get_site_path("private", first.scorm_package_path.lstrip("/"))
		self.assertTrue(os.path.isfile(os.path.join(first_dir, "index.html")))

	def test_deleting_a_slash_titled_chapter_removes_its_own_package(self):
		chapter = self._upsert("Module/Intro")
		package_dir = frappe.get_site_path("private", chapter.scorm_package_path.lstrip("/"))
		self.assertTrue(os.path.isfile(os.path.join(package_dir, "index.html")))

		frappe.set_user(self.instructor.name)
		delete_chapter(chapter.name)
		frappe.set_user("Administrator")

		self.assertFalse(os.path.exists(package_dir), "package survived deleting its own chapter")


class TestRejectedScormReplacementPreservesWorkingFiles(BaseTestUtils):
	"""extract_package used to rmtree the chapter's existing package before checking
	the new upload's containment, so a rejected replacement erased working files."""

	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6).lower()
		self.instructor = self._create_user(f"spc-r-{hash}@example.com", "Rae", "Reject", ["Course Creator"])
		self.course = self._create_course(
			title=f"SCORM Reject Replace {hash}", instructor=self.instructor.name
		)

		self._tmp = tempfile.mkdtemp()
		self.addCleanup(shutil.rmtree, self._tmp, True)

		course_scorm_dir = os.path.join(
			os.path.realpath(frappe.get_site_path("private", "scorm")), self.course.name
		)
		self.addCleanup(shutil.rmtree, course_scorm_dir, True)

	def _upload(self, file_name, entries):
		zip_path = os.path.join(self._tmp, file_name)
		with zipfile.ZipFile(zip_path, "w") as zf:
			for entry_name, content in entries:
				zf.writestr(entry_name, content)
		with open(zip_path, "rb") as f:
			return frappe.get_doc(
				{"doctype": "File", "file_name": file_name, "is_private": 1, "content": f.read()}
			).insert()

	def test_a_rejected_replacement_leaves_the_working_package_intact(self):
		good_package = self._upload(
			"good.zip",
			[
				("index.html", "<html>working</html>"),
				(
					"imsmanifest.xml",
					'<?xml version="1.0"?>'
					'<manifest xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">'
					'<resource adlcp:scormtype="sco" href="index.html"/></manifest>',
				),
			],
		)

		frappe.set_user(self.instructor.name)
		chapter = upsert_chapter("Working Chapter", self.course.name, True, {"name": good_package.name})
		frappe.set_user("Administrator")

		package_dir = frappe.get_site_path("private", chapter.scorm_package_path.lstrip("/"))
		self.assertTrue(os.path.isfile(os.path.join(package_dir, "index.html")))

		evil_path = os.path.join(self._tmp, "evil-escape.html")
		self.addCleanup(lambda: os.path.exists(evil_path) and os.remove(evil_path))
		rel_to_escape = os.path.relpath(evil_path, package_dir)
		evil_package = self._upload("evil.zip", [(rel_to_escape, "<script>pwn</script>")])

		frappe.set_user(self.instructor.name)
		with self.assertRaises(frappe.exceptions.ValidationError):
			upsert_chapter(
				"Working Chapter",
				self.course.name,
				True,
				{"name": evil_package.name},
				name=chapter.name,
			)
		frappe.set_user("Administrator")

		self.assertTrue(
			os.path.isfile(os.path.join(package_dir, "index.html")),
			"a rejected replacement erased the chapter's working files",
		)
		self.assertFalse(os.path.exists(evil_path), "zip-slip entry escaped the temp extraction dir")
