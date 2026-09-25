"""Audit log for every tool call and every approved write."""

import json

import frappe
from frappe.utils import cint

MAX_ARGUMENT_CHARS = 4000
MAX_SUMMARY_CHARS = 500


def _truncate(value, limit):
	return value if len(value) <= limit else value[: limit - 1] + "…"


def _arguments(arguments):
	try:
		serialised = json.dumps(arguments or {}, ensure_ascii=False, default=str)
	except (TypeError, ValueError):
		serialised = "{}"
	if len(serialised) > MAX_ARGUMENT_CHARS:
		return json.dumps({"truncated": _truncate(serialised, MAX_ARGUMENT_CHARS)}, ensure_ascii=False)
	return serialised


def summarise(result):
	if result is None:
		return None
	if isinstance(result, dict):
		keys = ("name", "proposal", "status", "draft", "conversation", "count")
		picked = {key: result[key] for key in keys if key in result}
		text = json.dumps(picked or {"keys": sorted(result)[:12]}, ensure_ascii=False, default=str)
	elif isinstance(result, list):
		text = f"{len(result)} item(s)"
	else:
		text = str(result)
	return _truncate(text, MAX_SUMMARY_CHARS)


def log_tool(
	tool,
	status,
	*,
	audience=None,
	arguments=None,
	result=None,
	error=None,
	duration_ms=None,
	is_write=False,
	model=None,
	tokens_in=None,
	tokens_out=None,
	conversation=None,
	proposal=None,
	durable=False,
):
	"""Insert a Copilot Tool Log row. Logging must never break the tool call.

	``durable`` is for calls that are about to raise: the request will be rolled
	back, so the partial work is discarded first and the log row is committed on
	its own. Denied and failed calls must stay visible in the audit trail.
	"""
	if durable and not frappe.flags.in_test:
		frappe.db.rollback()
	try:
		frappe.get_doc(
			{
				"doctype": "Copilot Tool Log",
				"tool": tool,
				"user": frappe.session.user,
				"audience": ", ".join(sorted(audience)) if isinstance(audience, (set, list)) else audience,
				"status": status,
				"is_write": 1 if is_write else 0,
				"arguments": _arguments(arguments),
				"result_summary": summarise(result),
				"error": _truncate(str(error), MAX_SUMMARY_CHARS) if error else None,
				"duration_ms": int(duration_ms or 0),
				"model": model,
				"tokens_in": cint(tokens_in) or None,
				"tokens_out": cint(tokens_out) or None,
				"conversation": _existing("Copilot Conversation", conversation),
				"proposal": _existing("Copilot Proposal", proposal),
			}
		).insert(ignore_permissions=True)
		if durable and not frappe.flags.in_test:
			frappe.db.commit()  # nosemgrep: the request is rolled back after this
	except Exception:
		frappe.log_error(title="Copilot tool log failed")


def _existing(doctype, name):
	return name if name and frappe.db.exists(doctype, name) else None
