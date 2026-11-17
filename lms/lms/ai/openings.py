"""A conversation's opening, written while the learner reads the screen before it.

Opening a session and having the model write its first reply takes seconds. A lesson and a
role-play each show a screen with a Start button first, so the page asks for the conversation
when that screen shows, and Start takes the session whose opening is already written."""

from collections.abc import Callable

import frappe

# A screen left open longer than this gets a fresh opening, so the brief stays current.
WAITING_FOR = 30 * 60


def prepared(assignment: str, index: int, open_session: Callable) -> str:
	"""The session waiting for this learner's step, opened with `open_session` when none is."""
	name = frappe.cache.get_value(_key(assignment, index))
	if not _waiting(name):
		name = open_session().name
		frappe.cache.set_value(_key(assignment, index), name, expires_in_sec=WAITING_FOR)
	return name


def take(assignment: str, index: int) -> str | None:
	"""The waiting session, once: a second Start opens a new conversation."""
	key = _key(assignment, index)
	name = frappe.cache.get_value(key)
	frappe.cache.delete_value(key)
	return name if _waiting(name) else None


def forget(assignment: str) -> None:
	"""Drop what waits for a learner whose progress was reset: its brief recalls their old answers."""
	frappe.cache.delete_keys(f"lms:opening:{assignment}:")


def _key(assignment: str, index: int) -> str:
	return f"lms:opening:{assignment}:{index}:{frappe.session.user}"


def _waiting(name: str | None) -> bool:
	return bool(name) and frappe.db.exists("Flow Session", {"name": name, "owner": frappe.session.user})
