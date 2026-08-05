# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

"""SCORM security regression tests: extraction/serving containment + hostile manifest parsing (XXE, amplification, traversal href). Excludes content execution (documented trust model, sandbox-origin mitigation)."""

import os
import shutil
import stat
import tempfile
import time
import unittest
import zipfile
from xml.parsers.expat import ExpatError

import frappe

from lms.lms.api import _scorm_extract_path, extract_package, get_launch_file
from lms.page_renderers import SCORMRenderer


class TestScormExtractPath(unittest.TestCase):
	"""A traversal chapter title must not resolve outside the course's own dir."""

	def test_normal_title_stays_in_course_dir(self):
		course_root = os.path.realpath(frappe.get_site_path("private", "scorm", "my-course"))
		path = _scorm_extract_path("my-course", "chapter-1")
		self.assertEqual(path, os.path.join(course_root, "chapter-1"))

	def test_parent_traversal_in_title_is_rejected(self):
		with self.assertRaises(frappe.exceptions.ValidationError):
			_scorm_extract_path("my-course", "../victim-course/victim-chapter")

	def test_nested_traversal_in_title_is_rejected(self):
		with self.assertRaises(frappe.exceptions.ValidationError):
			_scorm_extract_path("my-course", "sub/../../victim-course/x")

	def test_absolute_title_is_rejected(self):
		with self.assertRaises(frappe.exceptions.ValidationError):
			_scorm_extract_path("my-course", "/srv/other/x")

	def test_empty_course_is_rejected(self):
		# An empty course collapses course_root to the scorm root, so a title could reach a sibling course.
		with self.assertRaises(frappe.exceptions.ValidationError):
			_scorm_extract_path("", "victim-course/chapter-1")

	def test_dot_course_is_rejected(self):
		with self.assertRaises(frappe.exceptions.ValidationError):
			_scorm_extract_path(".", "victim-course/chapter-1")

	def test_dot_title_is_rejected(self):
		# "." collapses extract_path to course_root, whose rmtree would wipe every chapter.
		with self.assertRaises(frappe.exceptions.ValidationError):
			_scorm_extract_path("my-course", ".")

	def test_empty_title_is_rejected(self):
		with self.assertRaises(frappe.exceptions.ValidationError):
			_scorm_extract_path("my-course", "")

	def test_sub_parent_title_collapsing_to_course_root_is_rejected(self):
		with self.assertRaises(frappe.exceptions.ValidationError):
			_scorm_extract_path("my-course", "sub/..")


class TestScormExtractContainment(unittest.TestCase):
	"""extract_package() must never write outside the package's own course dir."""

	COURSE_A = "ct-scorm-course-a"
	COURSE_B = "ct-scorm-course-b"

	def setUp(self):
		self.scorm_root = os.path.realpath(frappe.get_site_path("private", "scorm"))
		self._tmp = tempfile.mkdtemp()
		self.zip_path = os.path.join(self._tmp, "pkg.zip")
		self._make_zip([("index.html", "<html>ok</html>")])

		# Stub the File lookup so extract_package reads our temp zip (no real File doc).
		self._orig_get_doc = frappe.get_doc

		def fake_get_doc(doctype, *args, **kwargs):
			if doctype == "File":
				return frappe._dict(get_full_path=lambda: self.zip_path)
			return self._orig_get_doc(doctype, *args, **kwargs)

		frappe.get_doc = fake_get_doc
		self._stray_paths = []

	def tearDown(self):
		frappe.get_doc = self._orig_get_doc
		shutil.rmtree(self._tmp, ignore_errors=True)
		for course in (self.COURSE_A, self.COURSE_B):
			shutil.rmtree(os.path.join(self.scorm_root, course), ignore_errors=True)
		for p in self._stray_paths:
			if os.path.lexists(p):
				os.remove(p)

	def _make_zip(self, entries):
		with zipfile.ZipFile(self.zip_path, "w") as zf:
			for name, content in entries:
				zf.writestr(name, content)

	def _extract(self, course, title):
		return extract_package(course, title, frappe._dict(name="dummy"))

	def test_benign_title_extracts_inside_course_dir(self):
		path = self._extract(self.COURSE_A, "chapter-1")
		course_root = os.path.join(self.scorm_root, self.COURSE_A)
		self.assertTrue(os.path.realpath(path).startswith(course_root + os.sep))
		self.assertTrue(os.path.isfile(os.path.join(path, "index.html")))

	def test_traversal_title_cannot_overwrite_another_course(self):
		victim_dir = os.path.join(self.scorm_root, self.COURSE_B, "victim-chapter")
		with self.assertRaises(frappe.exceptions.ValidationError):
			self._extract(self.COURSE_A, f"../{self.COURSE_B}/victim-chapter")
		self.assertFalse(os.path.exists(victim_dir), "traversal title wrote into another course")

	def test_absolute_title_is_rejected(self):
		with self.assertRaises(frappe.exceptions.ValidationError):
			self._extract(self.COURSE_A, "/srv/elsewhere/chapter")

	def test_dot_title_cannot_wipe_the_course_dir(self):
		# A "." title collapses to course_root; extract_package must refuse it before rmtree deletes sibling chapters.
		sibling = os.path.join(self.scorm_root, self.COURSE_A, "existing-chapter")
		os.makedirs(sibling, exist_ok=True)
		with open(os.path.join(sibling, "keep.html"), "w") as f:
			f.write("keep")
		with self.assertRaises(frappe.exceptions.ValidationError):
			self._extract(self.COURSE_A, ".")
		self.assertTrue(
			os.path.isfile(os.path.join(sibling, "keep.html")), "'.' title wiped a sibling chapter"
		)

	def test_zip_slip_entry_is_rejected(self):
		stray = os.path.join(self._tmp, "zipslip_evil.html")
		rel_to_stray = os.path.relpath(stray, os.path.join(self.scorm_root, self.COURSE_A, "ch"))
		self._stray_paths.append(stray)
		self._make_zip([("index.html", "ok"), (rel_to_stray, "<script>pwn</script>")])
		with self.assertRaises(frappe.exceptions.ValidationError):
			self._extract(self.COURSE_A, "ch")
		self.assertFalse(os.path.exists(stray), "zip-slip entry escaped the extraction dir")

	def test_zip_symlink_entry_is_rejected(self):
		# Symlink entries are refused before extraction, so a symlink-then-traverse chain can't form.
		zi = zipfile.ZipInfo("link")
		zi.external_attr = (stat.S_IFLNK | 0o777) << 16
		with zipfile.ZipFile(self.zip_path, "w") as zf:
			zf.writestr("index.html", "ok")
			zf.writestr(zi, "/etc/passwd")
		with self.assertRaises(frappe.exceptions.ValidationError):
			self._extract(self.COURSE_A, "chapter-1")
		self.assertFalse(os.path.exists(os.path.join(self.scorm_root, self.COURSE_A, "chapter-1", "link")))


class TestScormServingContainment(unittest.TestCase):
	"""_is_safe_path must contain served paths to the scorm root, resolving symlinks."""

	def setUp(self):
		self.scorm_root = os.path.realpath(frappe.get_site_path("private", "scorm"))
		os.makedirs(self.scorm_root, exist_ok=True)
		self._made = []

	def tearDown(self):
		for p in self._made:
			if os.path.islink(p) or os.path.isfile(p):
				os.remove(p)
			elif os.path.isdir(p):
				shutil.rmtree(p, ignore_errors=True)

	def _renderer(self, path="/scorm/c/t/index.html"):
		r = SCORMRenderer.__new__(SCORMRenderer)
		r.path = path
		return r

	def test_path_inside_scorm_root_is_allowed(self):
		inside = os.path.join(self.scorm_root, "c", "t", "index.html")
		self.assertTrue(self._renderer()._is_safe_path(inside))

	def test_parent_traversal_is_rejected(self):
		escape = os.path.join(self.scorm_root, "c", "t", "..", "..", "..", "..", "etc", "passwd")
		self.assertFalse(self._renderer()._is_safe_path(escape))

	def test_symlink_escaping_scorm_root_is_rejected(self):
		link = os.path.join(self.scorm_root, "ct-evil-link")
		self._made.append(link)
		if os.path.lexists(link):
			os.remove(link)
		os.symlink("/etc", link)
		# The symlink lives under scorm_root, but realpath resolves it to /etc.
		self.assertFalse(self._renderer()._is_safe_path(os.path.join(link, "passwd")))


class TestScormManifestParsing(unittest.TestCase):
	"""A hostile imsmanifest.xml must not read files, amplify, or yield a servable href."""

	# adlcp namespace must be declared on the root, else expat raises "unbound prefix" first.
	NS = 'xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"'

	def setUp(self):
		self._tmp = tempfile.mkdtemp()
		self.scorm_root = os.path.realpath(frappe.get_site_path("private", "scorm"))

	def tearDown(self):
		shutil.rmtree(self._tmp, ignore_errors=True)

	def _write_manifest(self, xml):
		with open(os.path.join(self._tmp, "imsmanifest.xml"), "w") as f:
			f.write(xml)
		return self._tmp

	def test_external_entity_does_not_leak_file_contents(self):
		# Modern expat refuses external entities (raises), so the file is never read.
		path = self._write_manifest(
			'<?xml version="1.0"?>\n'
			'<!DOCTYPE manifest [ <!ENTITY xxe SYSTEM "file:///etc/hostname"> ]>\n'
			f'<manifest {self.NS}><resource adlcp:scormtype="sco" href="&xxe;"/></manifest>'
		)
		with self.assertRaises(ExpatError):
			get_launch_file(path)

	def test_entity_amplification_is_bounded(self):
		# Billion-laughs: libexpat's amplification guard raises quickly instead of OOMing.
		entities = '<!ENTITY a "AAAAAAAAAA">\n'
		prev = "a"
		for i in range(1, 8):
			cur = chr(ord("a") + i)
			entities += f'<!ENTITY {cur} "{("&" + prev + ";") * 10}">\n'
			prev = cur
		path = self._write_manifest(
			f'<?xml version="1.0"?>\n<!DOCTYPE manifest [\n{entities}]>\n'
			f'<manifest {self.NS}><resource adlcp:scormtype="sco" href="&{prev};"/></manifest>'
		)
		start = time.time()
		with self.assertRaises(ExpatError):
			get_launch_file(path)
		self.assertLess(time.time() - start, 5, "entity expansion was not bounded")

	def test_traversal_launch_href_is_not_servable(self):
		# A traversal href resolves outside the scorm root, which _is_safe_path refuses.
		path = self._write_manifest(
			'<?xml version="1.0"?>\n'
			f'<manifest {self.NS}><resource adlcp:scormtype="sco" '
			'href="../../../../../../../etc/passwd"/></manifest>'
		)
		launch = get_launch_file(path)
		self.assertTrue(launch)
		renderer = SCORMRenderer.__new__(SCORMRenderer)
		renderer.path = "/scorm/c/t/launch"
		self.assertFalse(renderer._is_safe_path(launch), "traversal launch href resolved to a servable path")
