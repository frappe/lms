# Copyright (c) 2026, Frappe and contributors
# For license information, please see license.txt

"""Shared availability-window helpers for LMS Quiz and LMS Assignment."""

from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import get_datetime, now_datetime


def validate_schedule_fields(doc) -> None:
	"""DocType validate for enable_scheduling / schedule_start / schedule_end.

	When scheduling is off, clear start/end so stale values are not kept.
	When on, start is required and end (if set) must be after start.
	"""
	if not doc.enable_scheduling:
		doc.schedule_start = None
		doc.schedule_end = None
		return

	if not doc.schedule_start:
		frappe.throw(_("Schedule Start is required when scheduling is enabled."))

	if doc.schedule_end:
		start = get_datetime(doc.schedule_start)
		end = get_datetime(doc.schedule_end)
		if end <= start:
			frappe.throw(_("Schedule End must be after Schedule Start."))


def get_schedule_block_reason(
	enable_scheduling,
	schedule_start,
	schedule_end,
	*,
	now=None,
) -> str | None:
	"""Return 'not_started', 'ended', or None if the window is open."""
	if not enable_scheduling:
		return None

	now = now or now_datetime()
	if schedule_start and now < get_datetime(schedule_start):
		return "not_started"
	if schedule_end and now > get_datetime(schedule_end):
		return "ended"
	return None


def assert_within_schedule(
	enable_scheduling,
	schedule_start,
	schedule_end,
	*,
	label: str | None = None,
) -> None:
	"""Throw if the current time is outside the availability window."""
	reason = get_schedule_block_reason(enable_scheduling, schedule_start, schedule_end)
	if not reason:
		return

	item = label or _("This item")
	if reason == "not_started":
		frappe.throw(
			_("{0} opens on {1}.").format(item, frappe.format(schedule_start, {"fieldtype": "Datetime"})),
			frappe.ValidationError,
		)
	frappe.throw(
		_("The schedule for {0} has ended.").format(item),
		frappe.ValidationError,
	)


def assert_doc_within_schedule(doc, *, label: str | None = None) -> None:
	"""Convenience wrapper for a quiz/assignment document or dict."""
	assert_within_schedule(
		doc.get("enable_scheduling") if hasattr(doc, "get") else getattr(doc, "enable_scheduling", 0),
		doc.get("schedule_start") if hasattr(doc, "get") else getattr(doc, "schedule_start", None),
		doc.get("schedule_end") if hasattr(doc, "get") else getattr(doc, "schedule_end", None),
		label=label,
	)
