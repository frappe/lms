# Copyright (c) 2026, Frappe and contributors
# For license information, please see license.txt

from bs4 import BeautifulSoup
from frappe.utils.html_utils import sanitize_html

# Mirrors FORBID_TAGS of the `rich` profile in frontend/src/directives/safeHtmlLevels.ts;
# keep the two in sync. Frappe's write-time allowlist keeps every form control, so a
# phishing form survives storage and only the SPA drops it -- email and exports do not.
FORM_CONTROL_TAGS = (
	"form",
	"input",
	"button",
	"textarea",
	"select",
	"option",
	"label",
	"fieldset",
)


def sanitize_rich_text(value: str | None) -> str | None:
	"""Strip form controls from stored rich text, keeping the text they wrapped: nh3
	unwraps them, so `<button>Login</button>` leaves `Login` and `<input>` leaves nothing.
	Text/Small Text/Text Editor only; always_sanitize stops released frappe skipping JSON-shaped HTML."""
	# Not a parser's view of whether there is a tag: html.parser drops a tag left unclosed
	# at the end of the text, so such text looked tag-free and was stored as written.
	if not isinstance(value, str) or "<" not in value:
		return value

	return sanitize_html(value, always_sanitize=True, disallowed_tags=FORM_CONTROL_TAGS)


def to_plain_text(value: str | None) -> str | None:
	"""Text with every tag removed and the rest kept as typed, for fields shown as plain text.
	An HTML cleaner would store `a & b` as `a &amp; b`. Repeated until nothing changes, because
	get_text turns the text `&lt;b&gt;` into `<b>`, which the next pass removes. Each change
	shortens the text, so the loop ends."""
	if not isinstance(value, str):
		return value

	while (text := BeautifulSoup(value, "html.parser").get_text()) != value:
		value = text
	return value
