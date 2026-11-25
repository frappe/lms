# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import os
import shutil
from unittest.mock import patch

import frappe
from werkzeug.test import EnvironBuilder
from werkzeug.wrappers import Request

from lms.lms.doctype.course_chapter.course_chapter import get_scorm_lesson
from lms.lms.scorm_player import get_play_url, inject_bridge
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

	def _page(self, response):
		"""An HTML file as the package wrote it, without the SCORM API put before it."""
		return self._body(response).split("</script>", 1)[1]

	def test_asset_of_an_authorised_chapter_is_served(self):
		response = self._render_as(self.learner.name, f"scorm/{self.course_a.name}/{self.dir_a}/res/app.js")
		self.assertEqual(self._body(response), "var a = 1;")
		self.assertEqual(response.headers.get("X-Content-Type-Options"), "nosniff")

	def test_package_dir_serves_its_index(self):
		response = self._render_as(self.learner.name, f"scorm/{self.course_a.name}/{self.dir_a}")
		self.assertEqual(self._page(response), "<p>a-index</p>")

	def test_package_extracted_under_the_docname_is_served(self):
		response = self._render_as(
			self.learner.name, f"scorm/{self.course_a.name}/{self.chapter_c.name}/index.html"
		)
		self.assertEqual(self._page(response), "<p>c-index</p>")

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

	def _play_path(self, user, chapter, package_dir):
		"""The path a learner's player loads the package from, as get_scorm_playback hands it out."""
		frappe.set_user(user)
		try:
			url = get_play_url(
				f"/scorm/{chapter.course}/{package_dir}/index.html", get_scorm_lesson(chapter.name)
			)
		finally:
			frappe.set_user("Administrator")
		return url.removeprefix("/")

	def test_every_file_is_served_in_a_sandbox(self):
		for relpath in ("index.html", "res/app.js"):
			with self.subTest(relpath=relpath):
				response = self._render_as(
					self.learner.name, f"scorm/{self.course_a.name}/{self.dir_a}/{relpath}"
				)
				policy = response.headers.get("Content-Security-Policy")
				self.assertTrue(policy.startswith("sandbox "), policy)
				self.assertNotIn("allow-same-origin", policy)
				self.assertNotIn("allow-top-navigation", policy)
				self.assertEqual(response.headers.get("Referrer-Policy"), "no-referrer")
				response.close()

	def test_progress_is_posted_to_the_address_the_learner_opened(self):
		"""Not the configured host_name: a site reached on a custom domain would
		have every message dropped by the browser and no progress saved."""
		frappe.local.request = Request(
			EnvironBuilder(
				path="/scorm", base_url="http://learn.example.com", headers={"X-Forwarded-Proto": "https"}
			).get_environ()
		)
		with patch.dict(frappe.local.conf, {"host_name": "https://site.frappe.cloud"}):
			response = self._render_as(self.learner.name, f"scorm/{self.course_a.name}/{self.dir_a}")
		self.assertIn('"origin": "https://learn.example.com"', self._body(response))

	def test_an_html_file_carries_the_scorm_api_and_the_learners_saved_values(self):
		lesson = get_scorm_lesson(self.chapter_a.name)
		frappe.get_doc(
			{
				"doctype": "LMS Course Progress",
				"member": self.learner.name,
				"course": self.course_a.name,
				"chapter": self.chapter_a.name,
				"lesson": lesson,
				"status": "Partially Complete",
				"scorm_content": "resume-at-slide-4",
			}
		).insert(ignore_permissions=True)

		body = self._body(
			self._render_as(self.learner.name, f"scorm/{self.course_a.name}/{self.dir_a}/index.html")
		)

		self.assertIn("window.API =", body)
		self.assertIn("window.API_1484_11 =", body)
		self.assertIn('"cmi.suspend_data": "resume-at-slide-4"', body)
		self.assertIn('"cmi.core.lesson_status": "incomplete"', body)

	def test_a_play_token_serves_its_package_without_a_session(self):
		"""The sandboxed package loads its files with no cookie, as Guest."""
		path = self._play_path(self.learner.name, self.chapter_a, self.dir_a)

		self.assertEqual(self._page(self._render_as("Guest", path)), "<p>a-index</p>")
		asset = path.replace("/index.html", "/res/app.js")
		self.assertEqual(self._body(self._render_as("Guest", asset)), "var a = 1;")

	def test_a_sandboxed_package_can_fetch_its_own_files(self):
		"""Its origin is opaque, so a fetch of its own JSON is cross-origin."""
		path = self._play_path(self.learner.name, self.chapter_a, self.dir_a)
		response = self._render_as("Guest", path.replace("/index.html", "/res/app.js"))
		self.assertEqual(response.headers.get("Access-Control-Allow-Origin"), "*")
		response.close()

		response = self._render_as(self.learner.name, f"scorm/{self.course_a.name}/{self.dir_a}/res/app.js")
		self.assertIsNone(response.headers.get("Access-Control-Allow-Origin"))
		response.close()

	def test_a_play_token_reaches_no_other_package(self):
		token_path = self._play_path(self.learner.name, self.chapter_a, self.dir_a)
		token = token_path.split("/")[1]
		a, b = self.course_a.name, self.course_b.name
		for path in (
			f"scorm-play/{token}/{a}/{self.chapter_c.name}/index.html",
			f"scorm-play/{token}/{b}/{self.chapter_b.name}/secret.html",
			f"scorm-play/{token}/{a}/{self.dir_a}/../../{b}/{self.chapter_b.name}/secret.html",
		):
			with self.subTest(path=path):
				with self.assertRaises(frappe.PermissionError):
					self._render_as("Guest", path)

	def test_an_unknown_play_token_is_refused(self):
		for token in ("0" * 32, "not-a-token"):
			with self.subTest(token=token):
				with self.assertRaises(frappe.PermissionError):
					self._render_as(
						"Guest", f"scorm-play/{token}/{self.course_a.name}/{self.dir_a}/index.html"
					)

	def test_a_play_token_stops_working_once_the_learner_loses_access(self):
		path = self._play_path(self.learner.name, self.chapter_a, self.dir_a)
		frappe.db.delete("LMS Enrollment", {"member": self.learner.name, "course": self.course_a.name})

		with self.assertRaises(frappe.PermissionError):
			self._render_as("Guest", path)


class TestScormBridgeInjection(BaseTestUtils):
	def test_the_api_goes_in_before_the_packages_own_scripts(self):
		cases = {
			b"<!DOCTYPE html><html><head><script src=a.js></script></head></html>": b"<head>",
			b"<!doctype html><html lang=en><body>x</body></html>": b"<html lang=en>",
			b"<!DOCTYPE html><p>x</p>": b"<!DOCTYPE html>",
		}
		for html, after in cases.items():
			with self.subTest(html=html):
				out = inject_bridge(html, "Guest", None)
				head, _, rest = out.partition(after)
				self.assertTrue(rest.startswith(b"<script>"), out)
				self.assertTrue(out.endswith(html[len(head) + len(after) :]))

	def test_saved_values_cannot_close_the_script(self):
		with patch(
			"lms.lms.scorm_player._initial_values", return_value={"cmi.suspend_data": "</script><b>x"}
		):
			out = inject_bridge(b"<p>x</p>", "Guest", None)
		self.assertEqual(out.count(b"</script>"), 1)


class TestScormRendererClaim(BaseTestUtils):
	def test_claims_scorm_routes(self):
		for path in (
			"scorm/course/chapter/index.html",
			"/scorm/course/chapter",
			"scorm-play/token/c/p/i.html",
		):
			with self.subTest(path=path):
				self.assertTrue(SCORMRenderer(path=path).can_render())

	def test_leaves_other_routes_alone(self):
		for path in ("guides/scorm/intro", "my-scorm/guide", "scormish/page", "blog/scorm/x/y"):
			with self.subTest(path=path):
				self.assertFalse(SCORMRenderer(path=path).can_render())
