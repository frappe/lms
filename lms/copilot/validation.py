"""Argument validation shared by every Copilot tool.

Tool arguments come from an LLM, so every value is treated as untrusted input
and normalised before it can reach a proposal or an LMS record.
"""

import json

import frappe
from frappe import _

CONFIDENCE_LEVELS = ("High", "Medium", "Low")
MAX_TEXT = 20000


def fail(message):
	frappe.throw(message, frappe.ValidationError)


def parse_object(value, label):
	if isinstance(value, str):
		try:
			value = json.loads(value)
		except (TypeError, ValueError):
			fail(_("{0} must be valid JSON.").format(label))
	if not isinstance(value, dict):
		fail(_("{0} must be an object.").format(label))
	return value


def parse_list(value, label, minimum=0, maximum=None):
	if isinstance(value, str):
		try:
			value = json.loads(value)
		except (TypeError, ValueError):
			fail(_("{0} must be valid JSON.").format(label))
	if not isinstance(value, list):
		fail(_("{0} must be a list.").format(label))
	if len(value) < minimum:
		fail(_("{0} must contain at least {1} item(s).").format(label, minimum))
	if maximum is not None and len(value) > maximum:
		fail(_("{0} can contain at most {1} items.").format(label, maximum))
	return value


def required_text(value, label, max_length=MAX_TEXT):
	if not isinstance(value, str) or not value.strip():
		fail(_("{0} is required.").format(label))
	value = value.strip()
	if len(value) > max_length:
		fail(_("{0} is too long.").format(label))
	return value


def optional_text(value, label, max_length=MAX_TEXT):
	if value is None or value == "":
		return None
	return required_text(value, label, max_length)


def integer(value, label, minimum=0, maximum=None):
	if isinstance(value, bool):
		fail(_("{0} must be a whole number.").format(label))
	try:
		parsed = int(value)
	except (TypeError, ValueError):
		fail(_("{0} must be a whole number.").format(label))
	if not isinstance(value, int) and str(value).strip() not in {str(parsed), f"{parsed}.0"}:
		fail(_("{0} must be a whole number.").format(label))
	if parsed < minimum or (maximum is not None and parsed > maximum):
		if maximum is None:
			fail(_("{0} must be at least {1}.").format(label, minimum))
		fail(_("{0} must be between {1} and {2}.").format(label, minimum, maximum))
	return parsed


def boolean(value, label):
	if isinstance(value, bool):
		return int(value)
	if isinstance(value, int) and value in {0, 1}:
		return value
	if isinstance(value, str) and value.strip().lower() in {"true", "false", "1", "0"}:
		return int(value.strip().lower() in {"true", "1"})
	fail(_("{0} must be true or false.").format(label))


def confidence(value, label, default="Medium"):
	if value is None or value == "":
		return default
	if isinstance(value, str):
		normalised = value.strip().capitalize()
		if normalised in CONFIDENCE_LEVELS:
			return normalised
	fail(_("{0} must be High, Medium or Low.").format(label))


def lowest_confidence(values):
	"""The least confident criterion labels the whole draft."""
	ranked = [CONFIDENCE_LEVELS.index(value) for value in values if value in CONFIDENCE_LEVELS]
	return CONFIDENCE_LEVELS[max(ranked)] if ranked else "Medium"


def existing(doctype, name, label):
	name = required_text(name, label, 140)
	if not frappe.db.exists(doctype, name):
		frappe.throw(_("{0} not found.").format(label), frappe.DoesNotExistError)
	return name


def load_json(value, default=None):
	if value in (None, ""):
		return default
	if isinstance(value, (dict, list)):
		return value
	try:
		return json.loads(value)
	except (TypeError, ValueError):
		return default
