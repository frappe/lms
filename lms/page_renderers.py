"""Custom page renderers for LMS app.

Handles rendering of profile pages.
"""

import mimetypes
import os

import frappe
from frappe.website.page_renderers.base_renderer import BaseRenderer
from werkzeug.wrappers import Response
from werkzeug.wsgi import wrap_file


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
			response = Response(wrap_file(frappe.local.request.environ, f), direct_passthrough=True)
			response.mimetype = mimetypes.guess_type(path)[0]
			return response
		else:
			path = path.replace(".html", "")
			if os.path.exists(path) and os.path.isdir(path):
				index_path = os.path.join(path, "index.html")
				if os.path.exists(index_path):
					f = open(index_path, "rb")
					response = Response(wrap_file(frappe.local.request.environ, f), direct_passthrough=True)
					response.mimetype = mimetypes.guess_type(index_path)[0]
					return response
			elif not os.path.exists(path):
				chapter_folder = "/".join(self.path.split("/")[:3])
				chapter_folder_path = os.path.realpath(frappe.get_site_path("public", chapter_folder))
				file = path.split("/")[-1]
				correct_file_path = None

				for root, _dirs, files in os.walk(chapter_folder_path):
					if file in files:
						correct_file_path = os.path.join(root, file)
						break

				if correct_file_path:
					f = open(correct_file_path, "rb")
					response = Response(wrap_file(frappe.local.request.environ, f), direct_passthrough=True)
					response.mimetype = mimetypes.guess_type(correct_file_path)[0]
					return response
