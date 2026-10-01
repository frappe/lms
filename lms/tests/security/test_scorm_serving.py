# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import os
import shutil

import frappe
from werkzeug.test import EnvironBuilder
from werkzeug.wrappers import Request

from lms.lms.test_helpers import BaseTestUtils
from lms.page_renderers import SCORMRenderer


class TestScormServing(BaseTestUtils):
	"""SCORMRenderer serves a file only from the package directory of a chapter the
	session may open, and that chapter is read off the resolved path, not the URL."""

	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		self.instructor = self._create_user(f"ss-i-{hash}@example.com", "Ina", "Instr", ["Course Creator"])
		self.learner = self._create_user(f"ss-l-{hash}@example.com", "Lee", "Learner", [])
		self.course_a = self._create_course(title=f"SCORM Serve A {hash}", instructor=self.instructor.name)
		self.course_b = self._create_course(title=f"SCORM Serve B {hash}", instructor=self.instructor.name)
		# A sits in a title-named dir (packages extracted before e0132969e), B and C
		# in the docname-named dir upsert_chapter extracts to now.
		self.chapter_a = self._scorm_chapter(self.course_a.name, f"Pkg A {hash}", by_title=True)
		self.chapter_b = self._scorm_chapter(self.course_b.name, f"Pkg B {hash}")
		self.chapter_c = self._scorm_chapter(self.course_a.name, f"Pkg C {hash}", idx=2)
		self.dir_a = self.chapter_a.title
		self._create_enrollment(self.learner.name, self.course_a.name)

		self.scorm_root = frappe.get_site_path("private", "scorm")
		self._write(self.course_a.name, self.dir_a, "index.html", "<p>a-index</p>")
		self._write(self.course_a.name, self.dir_a, "res/app.js", "var a = 1;")
		self._write(self.course_a.name, self.chapter_c.name, "index.html", "<p>c-index</p>")
		self._write(self.course_a.name, "orphan-dir", "secret.html", "<p>orphan-secret</p>")
		self._write(self.course_b.name, self.chapter_b.name, "secret.html", "<p>b-secret</p>")
		self._write(self.course_b.name, self.chapter_b.name, "index.html", "<p>b-index</p>")

		self._previous_request = getattr(frappe.local, "request", None)
		frappe.local.request = Request(EnvironBuilder(path="/scorm").get_environ())

	def tearDown(self):
		frappe.local.request = self._previous_request
		for course in (self.course_a.name, self.course_b.name):
			shutil.rmtree(os.path.join(self.scorm_root, course), ignore_errors=True)
		super().tearDown()

	def _scorm_chapter(self, course, title, by_title=False, idx=1):
		chapter = self._create_chapter(title, course)
		self._create_chapter_reference(course, chapter.name, idx=idx)
		lesson = self._create_lesson(f"{title} lesson", chapter.name, course)
		self._create_lesson_reference(chapter.name, lesson.name)
		package_path = f"/scorm/{course}/{chapter.title if by_title else chapter.name}"
		frappe.db.set_value(
			"Course Chapter",
			chapter.name,
			{
				"is_scorm_package": 1,
				"scorm_package_path": package_path,
				"launch_file": f"{package_path}/index.html",
			},
		)
		return chapter

	def _write(self, course, package, relpath, body):
		path = os.path.join(self.scorm_root, course, package, relpath)
		os.makedirs(os.path.dirname(path), exist_ok=True)
		with open(path, "w") as f:
			f.write(body)

	def _render_as(self, user, path):
		frappe.set_user(user)
		try:
			return SCORMRenderer(path=path).render()
		finally:
			frappe.set_user("Administrator")

	def _body(self, response):
		body = b"".join(response.response)
		response.close()
		return body.decode()

	def test_asset_of_an_authorised_chapter_is_served(self):
		response = self._render_as(self.learner.name, f"scorm/{self.course_a.name}/{self.dir_a}/res/app.js")
		self.assertEqual(self._body(response), "var a = 1;")

	def test_package_dir_serves_its_index(self):
		response = self._render_as(self.learner.name, f"scorm/{self.course_a.name}/{self.dir_a}")
		self.assertEqual(self._body(response), "<p>a-index</p>")

	def test_package_extracted_under_the_docname_is_served(self):
		response = self._render_as(
			self.learner.name, f"scorm/{self.course_a.name}/{self.chapter_c.name}/index.html"
		)
		self.assertEqual(self._body(response), "<p>c-index</p>")

	def test_direct_request_for_another_course_is_refused(self):
		with self.assertRaises(frappe.PermissionError):
			self._render_as(
				self.learner.name, f"scorm/{self.course_b.name}/{self.chapter_b.name}/secret.html"
			)

	def test_a_case_variant_of_an_authorised_package_dir_is_refused(self):
		variant = self.dir_a.upper()
		self._write(self.course_a.name, variant, "secret.html", "<p>variant-secret</p>")
		with self.assertRaises(frappe.PermissionError):
			self._render_as(self.learner.name, f"scorm/{self.course_a.name}/{variant}/secret.html")

	def test_traversal_out_of_the_authorised_chapter_is_refused(self):
		a, b = self.course_a.name, self.course_b.name
		cases = {
			"other_course_file": f"scorm/{a}/{self.dir_a}/../../{b}/{self.chapter_b.name}/secret.html",
			"other_course_dir": f"scorm/{a}/{self.dir_a}/../../{b}/{self.chapter_b.name}",
			"same_course_non_package_dir": f"scorm/{a}/{self.dir_a}/../orphan-dir/secret.html",
			"scorm_root": f"scorm/{a}/{self.dir_a}/../..",
		}
		for user in (self.learner.name, "Guest"):
			for case, path in cases.items():
				with self.subTest(user=user, case=case):
					with self.assertRaises(frappe.PermissionError):
						self._render_as(user, path)

	def test_missing_file_answers_404_over_http(self):
		from frappe.website.serve import get_response

		frappe.set_user(self.learner.name)
		response = get_response(f"/scorm/{self.course_a.name}/{self.dir_a}/missing.js")
		self.assertEqual(response.status_code, 404)


class TestScormRendererClaim(BaseTestUtils):
	def test_claims_scorm_routes(self):
		for path in ("scorm/course/chapter/index.html", "/scorm/course/chapter"):
			with self.subTest(path=path):
				self.assertTrue(SCORMRenderer(path=path).can_render())

	def test_leaves_other_routes_alone(self):
		for path in ("guides/scorm/intro", "my-scorm/guide", "scormish/page", "blog/scorm/x/y"):
			with self.subTest(path=path):
				self.assertFalse(SCORMRenderer(path=path).can_render())
