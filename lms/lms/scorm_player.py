"""SCORM packages play in a sandbox: an opaque origin with no session, reaching the
learner's progress only through a message bridge to the player page."""

import json
import re
from functools import cache
from urllib.parse import urlsplit

import frappe

PLAY_PREFIX = "/scorm-play/"
PLAY_TOKEN_TTL = 12 * 60 * 60

# Everything a package may need except allow-same-origin, which would hand it the
# site's cookies, and top navigation, which would let it replace the LMS page.
SANDBOX = (
	"sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox "
	"allow-modals allow-downloads allow-pointer-lock allow-presentation"
)
SANDBOX_HEADERS = {
	"Content-Security-Policy": SANDBOX,
	# The play URL carries its token, so it must not leak to what a package links to.
	"Referrer-Policy": "no-referrer",
	"X-Content-Type-Options": "nosniff",
}
# The HTML carries this learner's saved values; the rest is the same for everyone.
HTML_HEADERS = {**SANDBOX_HEADERS, "Cache-Control": "private, no-store"}
# A sandboxed package has an opaque origin, so its own fetch, XHR and module script
# reads of its files are cross-origin. The token in the URL is what grants access and
# no cookie is involved, so any origin may read what the token already opens.
PLAY_HEADERS = {"Access-Control-Allow-Origin": "*"}

_HEAD = re.compile(rb"<head\b[^>]*>", re.IGNORECASE)
_HTML = re.compile(rb"<html\b[^>]*>", re.IGNORECASE)
_DOCTYPE = re.compile(rb"<!doctype\b[^>]*>", re.IGNORECASE)


def get_play_url(launch_file: str, lesson: str) -> str | None:
	"""The launch file behind a token that lets this learner's sandboxed package
	load the rest of its own files, which it cannot do with the session cookie."""
	if not launch_file or not launch_file.startswith("/scorm/"):
		return None
	parts = launch_file.removeprefix("/scorm/").split("/")
	if len(parts) < 3:
		return None

	token = frappe.generate_hash(length=32)
	frappe.cache.set_value(
		_cache_key(token),
		{"user": frappe.session.user, "course": parts[0], "package": parts[1], "lesson": lesson},
		expires_in_sec=PLAY_TOKEN_TTL,
	)
	return f"{PLAY_PREFIX}{token}/{'/'.join(parts)}"


def read_play_token(token: str) -> frappe._dict | None:
	if not token or not re.fullmatch(r"[0-9a-f]{32}", token):
		return None
	claims = frappe.cache.get_value(_cache_key(token))
	return frappe._dict(claims) if claims else None


def _cache_key(token: str) -> str:
	return f"lms:scorm-play:{token}"


def inject_bridge(html: bytes, user: str, lesson: str | None) -> bytes:
	"""Puts the SCORM API in the package's own window, before its scripts run, with
	the learner's saved values; what it sets is posted to the player page."""
	config = {"origin": _site_origin(), "values": _initial_values(user, lesson)}
	payload = json.dumps(config).replace("<", "\\u003c").replace("\u2028", "\\u2028")
	script = f"<script>{_bridge_source()}({payload});</script>".encode()

	for pattern in (_HEAD, _HTML, _DOCTYPE):
		match = pattern.search(html)
		if match:
			return html[: match.end()] + script + html[match.end() :]
	return script + html


def _initial_values(user: str, lesson: str | None) -> dict:
	progress = None
	if lesson:
		progress = frappe.db.get_value(
			"LMS Course Progress",
			{"member": user, "lesson": lesson},
			["status", "scorm_content"],
			as_dict=True,
		)
	saved = (progress and progress.scorm_content) or ""
	return {
		"cmi.core.lesson_status": "passed" if progress and progress.status == "Complete" else "incomplete",
		"cmi.launch_data": saved,
		"cmi.suspend_data": saved,
	}


def _site_origin() -> str:
	"""Where the player page is: the iframe loads from the same address, which a
	configured host_name need not be. The browser drops a message sent elsewhere."""
	url = urlsplit(frappe.utils.get_host_name_from_request() or frappe.utils.get_url())
	return f"{url.scheme}://{url.netloc}"


@cache
def _bridge_source() -> str:
	"""Read once per process: it is served inside every HTML file of a package."""
	# nosemgrep: frappe-semgrep-rules.rules.security.frappe-security-file-traversal - a fixed file shipped with this app, no request input in the path
	with open(frappe.get_app_path("lms", "lms", "scorm_bridge.js")) as f:
		return f.read().strip().rstrip(";")
