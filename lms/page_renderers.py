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
		return self.path.startswith("scorm/")

	# Disk roots tried, in order, to resolve SCORM bytes. New packages are extracted
	# under private/scorm (gated: /private is always routed through Frappe, so this
	# permission gate runs in production too). Legacy packages already extracted under
	# public/scorm are still served as a fallback, but the standard bench nginx config
	# serves public/ directly (try_files .../public/$uri @webserver), so for those legacy
	# files this Python gate is BYPASSED in production, exactly as before. Such packages
	# stay ungated in prod until re-uploaded (re-extraction lands them in private). New
	# uploads are gated in dev and prod alike.
	_DISK_ROOTS = ("private", "public")

	def render(self):
		authorised = set()
		for base in self._DISK_ROOTS:
			scorm_root = os.path.realpath(frappe.get_site_path(base, "scorm"))
			requested = os.path.realpath(os.path.join(scorm_root, self.path.removeprefix("scorm/")))
			course, package = self._package_of(scorm_root, requested)
			if (course, package) not in authorised:
				self._check_permission(course, package)
				authorised.add((course, package))

			path = self._find_file(os.path.join(scorm_root, course, package), requested)
			if path:
				return self._serve_file(path)

		# A cached 404 would outlive the package upload that adds this file.
		frappe.local.no_cache = 1
		raise frappe.PageDoesNotExistError

	def _package_of(self, scorm_root, requested):
		"""The <course>/<package> directory the resolved path sits in. Read off the
		resolved path, so `..` segments cannot name one chapter and serve another."""
		if os.path.commonpath((scorm_root, requested)) != scorm_root:
			raise frappe.PermissionError
		parts = os.path.relpath(requested, scorm_root).split(os.sep)
		if len(parts) < 2 or parts[0] == ".":
			raise frappe.PermissionError
		return parts[0], parts[1]

	def _check_permission(self, course, package):
		# Local import: course_chapter reaches lms.lms.utils at module load, the cycle
		# the permissions import here already stepped around this way.
		from lms.lms.doctype.course_chapter.course_chapter import (
			get_scorm_lesson,
			resolve_scorm_access,
		)

		package_path = f"/scorm/{course}/{package}"
		chapters = frappe.get_all(
			"Course Chapter",
			filters={"course": course, "is_scorm_package": 1, "scorm_package_path": package_path},
			fields=["name", "course", "scorm_package_path"],
			order_by="name asc",
		)
		# Sequential courses gate the bytes too, otherwise the SCORM page is a route
		# around the gate that never touches get_lesson. get_scorm_playback answers the
		# player off this same predicate, so what it offers and what this serves cannot drift.
		for chapter in chapters:
			# The database compares without case; the directory on disk does not.
			if chapter.course != course or chapter.scorm_package_path != package_path:
				continue
			access = resolve_scorm_access(course, get_scorm_lesson(chapter.name))
			if access.can_access and not access.locked:
				return

		frappe.logger("lms.security").warning(
			"SCORM resource access denied: user=%s path=%s",
			frappe.session.user,
			self.path,
		)
		raise frappe.PermissionError

	def _find_file(self, package_dir, requested):
		candidates = [requested]
		if not os.path.splitext(requested)[1]:
			candidates.append(f"{requested}.html")
		candidates.append(os.path.join(requested, "index.html"))

		path = next((c for c in candidates if os.path.isfile(c)), None)
		if not path and not os.path.exists(requested):
			path = self._find_by_name(package_dir, os.path.basename(requested))
		if not path:
			return None

		# A legacy package can hold a symlink; serve only what resolves inside it.
		resolved = os.path.realpath(path)
		if os.path.commonpath((package_dir, resolved)) != package_dir:
			raise frappe.PermissionError
		return resolved

	def _find_by_name(self, package_dir, name):
		"""Packages that reference an asset by a wrong relative path still play: the
		first file of that name anywhere in the package is served."""
		for root, _dirs, files in os.walk(package_dir):
			if name in files:
				return os.path.join(root, name)
		return None

	def _serve_file(self, path):
		f = open(path, "rb")
		response = Response(wrap_file(frappe.local.request.environ, f), direct_passthrough=True)
		response.mimetype = mimetypes.guess_type(path)[0]
		return response
