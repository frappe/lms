# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""Regressions from #2286 (a4a0a76ad, 6338a5911): the course export zipped any private file a
lesson upload block named, and echoed the exception with the bench path. Tests added for
audit findings #10 and #88 on branch fix/course-export-files."""

import io
import json
import os
import zipfile
from unittest.mock import patch

import frappe

from lms.lms.api import export_course_as_zip
from lms.lms.course_import_export import asset_member_path
from lms.lms.test_helpers import BaseTestUtils


class TestCourseExportFiles(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.hash = frappe.generate_hash(length=8).lower()
		self.creator = self._create_user(
			f"cef-c-{self.hash}@example.com", "Cora", "Creator", ["Course Creator"]
		).name
		self.co_instructor = self._create_user(
			f"cef-i-{self.hash}@example.com", "Ian", "Structor", ["Course Creator"]
		).name
		self.victim = self._create_user(f"cef-v-{self.hash}@example.com", "Vic", "Tim", ["LMS Student"]).name
		self.course = self._create_course(f"CEF Course {self.hash}", instructor=self.creator)
		self.course.append("instructors", {"instructor": self.co_instructor})
		self.course.save()
		self.chapter = self._create_chapter(f"CEF Chapter {self.hash}", self.course.name)
		self.lesson = self._create_lesson(f"CEF Lesson {self.hash}", self.chapter.name, self.course.name)
		# Course Creator writes only lessons it owns, and frappe checks write before attaching a file.
		frappe.db.set_value("Course Lesson", self.lesson.name, "owner", self.creator)

	def _upload(self, owner, file_name, **attached_to):
		frappe.set_user(owner)
		# nosemgrep: lms-unjustified-ignore-permissions - stands in for upload_file, which owns the row the same way
		file = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": file_name,
				"is_private": 1,
				"content": f"{owner} {file_name} {self.hash}".encode(),
				**attached_to,
			}
		).insert(ignore_permissions=True)
		self.addCleanup(self._remove_from_disk, file.get_full_path())
		frappe.set_user("Administrator")
		return file

	@staticmethod
	def _remove_from_disk(path):
		if os.path.exists(path):
			os.remove(path)

	def _cite_in_lesson(self, *file_urls):
		blocks = [{"type": "upload", "data": {"file_url": url}} for url in file_urls]
		frappe.db.set_value("Course Lesson", self.lesson.name, "content", json.dumps({"blocks": blocks}))

	def _export(self, user=None):
		frappe.set_user(user or self.creator)
		try:
			export_course_as_zip(self.course.name)
		finally:
			frappe.set_user("Administrator")
		response = frappe.local.response
		self.addCleanup(self._remove_from_disk, frappe.get_site_path("private", "files", response.filename))
		return zipfile.ZipFile(io.BytesIO(response.filecontent))

	def test_another_users_private_file_cited_in_a_lesson_is_not_exported(self):
		secret = self._upload(self.victim, f"secret-{self.hash}.txt")
		self._cite_in_lesson(secret.file_url)

		archive = self._export()

		self.assertNotIn(asset_member_path(secret.file_url), archive.namelist())
		self.assertIn("course.json", archive.namelist())

	def test_a_case_variant_of_the_exporters_own_file_does_not_unlock_the_victims(self):
		# The exporter's row first, so the victim's is the newer one a lookup returns first.
		self._upload(self.creator, f"SECRET-{self.hash}.txt")
		secret = self._upload(self.victim, f"secret-{self.hash}.txt")
		self._cite_in_lesson(secret.file_url)

		archive = self._export()

		self.assertNotIn(asset_member_path(secret.file_url), archive.namelist())

	def _forge_row(self, file_url):
		"""A File row the exporter creates through frappe's own insert, naming file_url."""
		frappe.set_user(self.creator)
		try:
			return frappe.get_doc(
				{
					"doctype": "File",
					"file_url": file_url,
					"is_private": 1,
					"attached_to_doctype": "Course Lesson",
					"attached_to_name": self.lesson.name,
				}
			).insert()
		finally:
			frappe.set_user("Administrator")

	def test_a_row_naming_the_victims_url_after_a_newer_case_variant_does_not_export_it(self):
		secret = self._upload(self.victim, f"secret-{self.hash}.txt")
		# A newer own case-variant row satisfies frappe's one-row private-file check.
		self._upload(self.creator, f"SECRET-{self.hash}.txt")
		forged = self._forge_row(secret.file_url)
		self.assertEqual(forged.file_url, secret.file_url)
		self._cite_in_lesson(secret.file_url)

		archive = self._export()

		self.assertNotIn(asset_member_path(secret.file_url), archive.namelist())

	def test_a_row_naming_a_non_canonical_path_to_the_victims_file_does_not_export_it(self):
		secret = self._upload(self.victim, f"secret-{self.hash}.txt")
		for variant in ("/private/files//", "/private/files/./"):
			with self.subTest(variant=variant):
				forged = self._forge_row(variant + secret.file_name)
				self._cite_in_lesson(forged.file_url)

				archive = self._export()

				self.assertNotIn(asset_member_path(forged.file_url), archive.namelist())
				self.assertEqual([m for m in archive.namelist() if m.startswith("assets/")], [])

	def test_a_row_whose_url_climbs_out_of_the_site_does_not_export_the_host_file(self):
		frappe.set_user(self.creator)
		try:
			frappe.get_doc(
				{"doctype": "File", "file_name": "hosts", "file_url": "/api/method/../../etc/hosts"}
			).insert()
		finally:
			frappe.set_user("Administrator")
		self._cite_in_lesson("/api/method/../../etc/hosts")

		archive = self._export()

		self.assertEqual([m for m in archive.namelist() if m.startswith("assets/")], [])

	def test_the_courses_own_files_are_exported(self):
		own = self._upload(self.creator, f"own-{self.hash}.txt")
		lesson_file = self._upload(
			self.co_instructor,
			f"lesson-{self.hash}.txt",
			attached_to_doctype="Course Lesson",
			attached_to_name=self.lesson.name,
		)
		image = self._upload(
			self.co_instructor,
			f"image-{self.hash}.txt",
			attached_to_doctype="LMS Course",
			attached_to_name=self.course.name,
		)
		frappe.db.set_value("LMS Course", self.course.name, "image", image.file_url)
		self._cite_in_lesson(own.file_url, lesson_file.file_url)

		archive = self._export()

		for file in (own, lesson_file, image):
			with self.subTest(file=file.file_name):
				member = archive.read(asset_member_path(file.file_url))
				self.assertEqual(member, f"{file.owner} {file.file_name} {self.hash}".encode())

	def test_a_missing_or_remote_file_is_skipped_without_failing_the_export(self):
		gone = self._upload(self.creator, f"gone-{self.hash}.txt")
		os.remove(gone.get_full_path())
		kept = self._upload(self.creator, f"kept-{self.hash}.txt")
		remote_url = f"https://example.invalid/cef-{self.hash}.png"
		frappe.get_doc({"doctype": "File", "file_url": remote_url}).insert()
		frappe.db.set_value("LMS Course", self.course.name, "image", remote_url)
		self._cite_in_lesson(gone.file_url, f"/private/files/no-row-{self.hash}.txt", kept.file_url)

		archive = self._export()

		self.assertNotIn(asset_member_path(gone.file_url), archive.namelist())
		self.assertIn(asset_member_path(kept.file_url), archive.namelist())

	def test_an_export_failure_does_not_reveal_the_server_path(self):
		site_path = os.path.abspath(frappe.get_site_path())
		frappe.local.message_log = []
		failure = OSError(f"[Errno 2] No such file or directory: '{site_path}/private/files/x.png'")

		with (
			patch("lms.lms.course_import_export.build_course_zip", side_effect=failure),
			patch.object(frappe, "log_error") as log_error,
		):
			frappe.set_user(self.creator)
			with self.assertRaises(frappe.ValidationError) as raised:
				export_course_as_zip(self.course.name)

		self.assertNotIn(site_path, str(raised.exception))
		self.assertNotIn(site_path, json.dumps(frappe.local.message_log, default=str))
		log_error.assert_called_once()
