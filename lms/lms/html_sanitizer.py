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


MAX_PLAIN_TEXT_PASSES = 10


def to_plain_text(value: str | None) -> str | None:
	"""Text with every tag removed and the rest kept as typed, for fields shown as plain text.
	An HTML cleaner would store `a & b` as `a &amp; b`. Repeated because get_text turns the
	text `&lt;b&gt;` into `<b>`, which the next pass removes. Each pass reads the whole text,
	so the passes are bounded."""
	if not isinstance(value, str):
		return value

	for _ in range(MAX_PLAIN_TEXT_PASSES):
		text = BeautifulSoup(value, "html.parser").get_text()
		if text == value:
			return value
		value = text
	# Still decoding after that many layers, which no one types: drop every `<` so nothing
	# left can open a tag.
	return value.replace("<", "")
