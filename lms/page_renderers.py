"""Custom page renderers for LMS app.

Handles rendering of profile pages.
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
	"""Returns the profile URL given username.

	The default URL prefix for profiles is /users, but tha can be customized.

	This functions looks at the current value from the config and generates
	the URL for the profile.
	"""
	return get_profile_url_prefix() + username


def get_profile_url_prefix():
	hooks = frappe.get_hooks("profile_url_prefix") or ["/users/"]
	return hooks[-1]


RE_INVALID_USERNAME = re.compile("[@!#$%^&*()<>?/\\|}{~:-]")


class ProfileRedirectPage(BaseRenderer):
	"""Renderer to redirect /profile_/foo to <profile_prefix>/foo.

	This is useful to redirect to profile pages from javascript as there is no
	easy to find the profile prefix.
	"""

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
		"""if "." in self.path:
		return False"""

		# has prefix and path starts with prefix?
		prefix = get_profile_url_prefix().lstrip("/")
		if prefix and not self.path.startswith(prefix):
			return False

		# not a userpage?
		username = self.get_username()
		""" if RE_INVALID_USERNAME.search(username):
			return False """
		# if there is prefix then we can allow all usernames
		if prefix:
			return True

		# if we are having top-level usernames, then give preference to
		# the existing website_route_rules, web pages, web forms etc.

		# Don't handle any of the exsiting website_route_rules
		routes = [rule["to_route"] for rule in frappe.get_hooks("website_route_rules")]
		if self.path in routes:
			return False

		# if any of the existing renders can render, let them do
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

		# check if path exists and is actually a file and not a folder
		if os.path.exists(path) and os.path.isfile(path):
			f = open(path, "rb")
			response = Response(
				wrap_file(frappe.local.request.environ, f), direct_passthrough=True
			)
			response.mimetype = mimetypes.guess_type(path)[0]
			return response
		else:
			path = path.replace(".html", "")
			if os.path.exists(path) and os.path.isdir(path):
				index_path = os.path.join(path, "index.html")
				if os.path.exists(index_path):
					f = open(index_path, "rb")
					response = Response(
						wrap_file(frappe.local.request.environ, f), direct_passthrough=True
					)
					response.mimetype = mimetypes.guess_type(index_path)[0]
					return response
			elif not os.path.exists(path):
				chapter_folder = "/".join(self.path.split("/")[:3])
				chapter_folder_path = os.path.realpath(
					frappe.get_site_path("public", chapter_folder)
				)
				file = path.split("/")[-1]
				correct_file_path = None

				for root, dirs, files in os.walk(chapter_folder_path):
					if file in files:
						correct_file_path = os.path.join(root, file)
						break

				if correct_file_path:
					f = open(correct_file_path, "rb")
					response = Response(
						wrap_file(frappe.local.request.environ, f), direct_passthrough=True
					)
					response.mimetype = mimetypes.guess_type(correct_file_path)[0]
					return response
