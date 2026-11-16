"""Custom page renderers for LMS app."""

import mimetypes
import os
from contextlib import contextmanager

import frappe
from frappe.website.page_renderers.base_renderer import BaseRenderer
from werkzeug.wrappers import Response
from werkzeug.wsgi import wrap_file

from lms.lms.scorm_player import (
	HTML_HEADERS,
	PLAY_HEADERS,
	SANDBOX_HEADERS,
	inject_bridge,
	read_play_token,
)


@contextmanager
def acting_as(user):
	"""Run the access checks as the token's learner, then put this request's own
	session back as it was: set_user also overwrites the sid and session data."""
	session = frappe.local.session
	saved = (session.user, session.sid, session.data, frappe.local.form_dict)
	# nosemgrep: frappe-semgrep-rules.rules.security.frappe-setuser - the learner a valid play token was issued to, only for the access checks below
	frappe.set_user(user)
	try:
		yield
	finally:
		# nosemgrep: frappe-semgrep-rules.rules.security.frappe-setuser - restores the request's own user
		frappe.set_user(saved[0])
		session.sid, session.data, frappe.local.form_dict = saved[1:]


class SCORMRenderer(BaseRenderer):
	def can_render(self):
		return self.path.startswith(("scorm/", "scorm-play/"))

	# Packages live under private/scorm, reachable only through Frappe, so this gate runs in
	# production; patches/v2_0/move_public_scorm_to_private moves pre-2026-06-09 ones there.
	# public/ is kept for a site that has not migrated yet, where nginx still serves it first.
	_DISK_ROOTS = ("private", "public")

	def render(self):
		if not self.path.startswith("scorm-play/"):
			return self._render(self.path, frappe.session.user)

		# A sandboxed package loads its files without the session cookie, so the
		# token stands in for it, for one learner and one package.
		token, _, rest = self.path.removeprefix("scorm-play/").partition("/")
		claims = read_play_token(token)
		if not claims:
			raise frappe.PermissionError
		with acting_as(claims.user):
			return self._render(f"scorm/{rest}", claims.user, claims)

	def _render(self, path, user, claims=None):
		authorised = {}
		for base in self._DISK_ROOTS:
			scorm_root = os.path.realpath(frappe.get_site_path(base, "scorm"))
			requested = os.path.realpath(os.path.join(scorm_root, path.removeprefix("scorm/")))
			course, package = self._package_of(scorm_root, requested)
			if claims and (course, package) != (claims.course, claims.package):
				raise frappe.PermissionError
			if (course, package) not in authorised:
				authorised[(course, package)] = self._check_permission(course, package)

			path_on_disk = self._find_file(os.path.join(scorm_root, course, package), requested)
			if path_on_disk:
				response = self._serve_file(path_on_disk, user, authorised[(course, package)])
				if claims:
					response.headers.update(PLAY_HEADERS)
				return response

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
			lesson = get_scorm_lesson(chapter.name)
			access = resolve_scorm_access(course, lesson)
			if access.can_access and not access.locked:
				return lesson

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

	def _serve_file(self, path, user, lesson):
		# The package is the course author's markup, so it runs with no origin of
		# its own: no session, no CSRF token, no reach into the LMS page.
		mimetype = mimetypes.guess_type(path)[0] or "application/octet-stream"
		if mimetype == "text/html":
			# nosemgrep: frappe-semgrep-rules.rules.security.frappe-security-file-traversal - _find_file resolved the path inside the package directory
			with open(path, "rb") as f:
				response = Response(inject_bridge(f.read(), user, lesson))
			response.headers.update(HTML_HEADERS)
		else:
			f = open(path, "rb")
			response = Response(wrap_file(frappe.local.request.environ, f), direct_passthrough=True)
			response.headers.update(SANDBOX_HEADERS)
		response.mimetype = mimetype
		return response
