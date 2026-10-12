# Copyright (c) 2026, FOSS United and Contributors
# See license.txt
"""An uploaded archive must not expand without bound.

frappe's upload cap limits only the compressed size; deflate reaches ~1000:1.
"""

import hashlib
import json
import os
import shutil
import struct
import tempfile
import unittest
import zipfile
from unittest.mock import patch

import frappe

from lms.lms import course_import_export
from lms.lms.api import extract_package
from lms.lms.course_import_export import import_course_zip

RATIO_BOMB = b"\0" * (5 * 1024 * 1024)


def incompressible(size):
	"""Deterministic bytes that still defeat DEFLATE: a SHA-256 counter-mode stream."""
	blocks = (hashlib.sha256(i.to_bytes(8, "big")).digest() for i in range(size // 32 + 1))
	return b"".join(blocks)[:size]


def lie_about_size(path, member, declared):
	"""Rewrite the uncompressed size the last member's local and central headers claim."""
	with open(path, "rb") as f:
		data = bytearray(f.read())
	with zipfile.ZipFile(path) as zf:
		info = zf.getinfo(member)
	struct.pack_into("<I", data, info.header_offset + 22, declared)
	central = data.rfind(b"PK\x01\x02")
	struct.pack_into("<I", data, central + 24, declared)
	with open(path, "wb") as f:
		f.write(data)


class TestCourseImportExpansionLimits(unittest.TestCase):
	def setUp(self):
		self.hash = frappe.generate_hash(length=8).lower()
		self.path = frappe.get_site_path("private", "files", f"expansion-{self.hash}.zip")
		self.addCleanup(lambda: os.path.exists(self.path) and os.remove(self.path))

	def _course_json(self, **extra):
		return json.dumps(
			{
				"title": f"Expansion Course {self.hash}",
				"short_introduction": "x",
				"description": "x",
				"instructors": [{"instructor": "Administrator"}],
				**extra,
			}
		)

	def _write(self, members, compression=zipfile.ZIP_DEFLATED):
		with zipfile.ZipFile(self.path, "w", compression=compression) as zf:
			zf.writestr("course.json", self._course_json())
			for name, content in members:
				zf.writestr(name, content)

	def _import(self):
		return import_course_zip(f"/private/files/{os.path.basename(self.path)}")

	def _assert_refused(self):
		with self.assertRaises(frappe.ValidationError):
			self._import()
		self.assertFalse(frappe.db.exists("LMS Course", {"title": f"Expansion Course {self.hash}"}))

	def test_too_many_members_is_refused(self):
		self._write((f"padding/{i}", b"") for i in range(course_import_export.MAX_ARCHIVE_MEMBERS))
		self._assert_refused()

	def test_a_member_compressed_past_the_ratio_is_refused(self):
		self._write([("padding.bin", RATIO_BOMB)])
		self._assert_refused()

	def test_expanding_past_the_total_is_refused(self):
		self._write(
			[("a.bin", incompressible(40_000)), ("b.bin", incompressible(40_000))],
			compression=zipfile.ZIP_STORED,
		)
		with patch.object(course_import_export, "MAX_ARCHIVE_BYTES", 64_000):
			self._assert_refused()

	def test_an_oversized_json_member_is_refused_not_skipped(self):
		"""read_json_from_zip swallows read errors into None, which would turn the
		refusal into a silently partial import."""
		padding = incompressible(2_000).hex()
		with zipfile.ZipFile(self.path, "w") as zf:
			zf.writestr("course.json", self._course_json(description=padding))
		with patch.object(course_import_export, "MAX_ARCHIVE_JSON_BYTES", 1_000):
			with self.assertRaises(frappe.ValidationError) as refused:
				self._import()
		self.assertNotIn("Missing course.json", str(refused.exception))

	def test_small_well_compressed_members_still_import(self):
		self._write([("padding.bin", b"\0" * course_import_export.MIN_RATIO_CHECK_BYTES)])
		course = self._import()
		self.assertTrue(frappe.db.exists("LMS Course", course))


class TestScormExpansionLimits(unittest.TestCase):
	COURSE = "ct-scorm-expansion"

	def setUp(self):
		self._tmp = tempfile.mkdtemp()
		self.zip_path = os.path.join(self._tmp, "pkg.zip")
		self.course_root = frappe.get_site_path("private", "scorm", self.COURSE)
		self.addCleanup(shutil.rmtree, self._tmp, ignore_errors=True)
		self.addCleanup(shutil.rmtree, self.course_root, ignore_errors=True)

		original_get_doc = frappe.get_doc

		def fake_get_doc(doctype, *args, **kwargs):
			if doctype == "File":
				return frappe._dict(get_full_path=lambda: self.zip_path)
			return original_get_doc(doctype, *args, **kwargs)

		stub = patch.object(frappe, "get_doc", fake_get_doc)
		stub.start()
		self.addCleanup(stub.stop)

	def _write(self, members, compression=zipfile.ZIP_DEFLATED):
		with zipfile.ZipFile(self.zip_path, "w", compression=compression) as zf:
			zf.writestr("index.html", "<html>ok</html>")
			for name, content in members:
				zf.writestr(name, content)

	def _extract(self):
		return extract_package(self.COURSE, "chapter-1", frappe._dict(name="dummy"))

	def _assert_refused(self):
		with self.assertRaises(frappe.ValidationError):
			self._extract()
		self.assertFalse(os.path.exists(self.course_root), "a refused package was extracted")

	def test_too_many_members_is_refused(self):
		self._write((f"padding/{i}", b"") for i in range(course_import_export.MAX_ARCHIVE_MEMBERS))
		self._assert_refused()

	def test_a_member_compressed_past_the_ratio_is_refused(self):
		self._write([("padding.bin", RATIO_BOMB)])
		self._assert_refused()

	def test_expanding_past_the_total_is_refused(self):
		self._write(
			[("a.bin", incompressible(40_000)), ("b.bin", incompressible(40_000))],
			compression=zipfile.ZIP_STORED,
		)
		with patch.object(course_import_export, "MAX_ARCHIVE_BYTES", 64_000):
			self._assert_refused()

	def test_a_normal_package_still_extracts(self):
		self._write([])
		path = self._extract()
		self.assertTrue(os.path.isfile(os.path.join(path, "index.html")))

	def test_a_refused_replacement_leaves_the_old_extraction_in_place(self):
		"""Re-uploading over an existing chapter must not delete the old extraction
		until the new archive has passed validate_archive."""
		self._write([])
		self._extract()
		marker = os.path.join(self.course_root, "chapter-1", "index.html")
		self.assertTrue(os.path.isfile(marker))

		self._write((f"padding/{i}", b"") for i in range(course_import_export.MAX_ARCHIVE_MEMBERS))
		with self.assertRaises(frappe.ValidationError):
			self._extract()
		self.assertTrue(os.path.isfile(marker), "a rejected re-upload deleted the old extraction")

	def test_an_understated_header_cannot_write_past_the_declared_size(self):
		"""The total check sums header sizes, so it holds only if extraction stops at
		the declared size. zipfile truncates there and then fails the CRC."""
		self._write([("big.bin", incompressible(50_000))], compression=zipfile.ZIP_STORED)
		lie_about_size(self.zip_path, "big.bin", 1_000)
		with self.assertRaises(zipfile.BadZipFile):
			self._extract()
		written = os.path.join(self.course_root, "chapter-1", "big.bin")
		self.assertLessEqual(os.path.getsize(written) if os.path.exists(written) else 0, 1_000)
