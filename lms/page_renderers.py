"""Custom page renderers for LMS app.

Handles rendering of profile pages and SCORM assets.
"""
import re
import os
import mimetypes
import frappe
from frappe.utils import get_files_path
from frappe.website.page_renderers.base_renderer import BaseRenderer
from frappe.website.page_renderers.document_page import DocumentPage
from frappe.website.page_renderers.list_page import ListPage
from frappe.website.page_renderers.not_found_page import NotFoundPage
from frappe.website.page_renderers.print_page import PrintPage
from frappe.website.page_renderers.redirect_page import RedirectPage
from frappe.website.page_renderers.static_page import StaticPage
from frappe.website.page_renderers.template_page import TemplatePage
from frappe.website.page_renderers.web_form import WebFormPage
from werkzeug.wrappers import Response
from werkzeug.wsgi import wrap_file


def get_profile_url(username):
	"""Returns the profile URL given username."""
	return get_profile_url_prefix() + username


def get_profile_url_prefix():
	hooks = frappe.get_hooks("profile_url_prefix") or ["/users/"]
	return hooks[-1]


RE_INVALID_USERNAME = re.compile("[@!#$%^&*()<>?/\\|}{~:-]")


class ProfileRedirectPage(BaseRenderer):
	"""Renderer to redirect /profile_/foo to <profile_prefix>/foo."""

	def can_render(self):
		return self.path.startswith("profile_/")

	def render(self):
		username = self.path[len("profile_/") :]
		frappe.flags.redirect_location = get_profile_url_prefix() + username
		return RedirectPage(self.path).render()


class ProfilePage(BaseRenderer):
	def __init__(self, path, http_status_code):
		super().__init__(path, http_status_code)
		self.renderer = None

	def can_render(self):
		prefix = get_profile_url_prefix().lstrip("/")
		if prefix and not self.path.startswith(prefix):
			return False

		username = self.get_username()

		if prefix:
			return True

		routes = [rule["to_route"] for rule in frappe.get_hooks("website_route_rules")]
		if self.path in routes:
			return False

		renderers = [StaticPage, WebFormPage, DocumentPage, TemplatePage, ListPage, PrintPage]
		for renderer in renderers:
			renderer_instance = renderer(self.path, 200)
			if renderer_instance.can_render():
				self.renderer = renderer_instance
				return True

		return True

	def get_username(self):
		prefix = get_profile_url_prefix().lstrip("/")
		return self.path[len(prefix) :]

	def render(self):
		if self.renderer:
			return self.renderer.render()
		else:
			username = self.get_username()
			return render_portal_page("profiles/profile", username=username)


def render_portal_page(path, **kwargs):
	frappe.form_dict.update(kwargs)
	page = TemplatePage(path)
	return page.render()


class SCORMRenderer(BaseRenderer):
	def can_render(self):
		return "scorm/" in self.path

	def render(self):
		path = os.path.join(frappe.local.site_path, "public", self.path.lstrip("/"))
		extension = os.path.splitext(path)[1]

		if not extension:
			path = f"{path}.html"

		if os.path.exists(path) and os.path.isfile(path):
			return self._serve_file(path)

		path = path.replace(".html", "")
		if os.path.exists(path) and os.path.isdir(path):
			index_path = os.path.join(path, "index.html")
			if os.path.exists(index_path):
				return self._serve_file(index_path)

		# Fallback: walk through SCORM folder to find file
		chapter_folder = "/".join(self.path.split("/")[:3])
		chapter_folder_path = os.path.realpath(
			frappe.get_site_path("public", chapter_folder)
		)
		file = self.path.split("/")[-1]
		correct_file_path = None

		for root, dirs, files in os.walk(chapter_folder_path):
			if file in files:
				correct_file_path = os.path.join(root, file)
				break

		if correct_file_path:
			return self._serve_file(correct_file_path)

		# ✅ Fix here: safely handle split() on lesson_index
		lesson_index = self.path.split("/")[-1]
		if "." in lesson_index:
			lesson_number = lesson_index.split(".")[1]
		else:
			lesson_number = None  # or frappe.throw("Invalid lesson_index format.")

		# (You can use lesson_number later for something...)

		return NotFoundPage(self.path).render()

	def _serve_file(self, file_path):
		f = open(file_path, "rb")
		response = Response(
			wrap_file(frappe.local.request.environ, f), direct_passthrough=True
		)
		response.mimetype = mimetypes.guess_type(file_path)[0]
		return response
