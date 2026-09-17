# Copyright (c) 2026, Frappe and contributors
# For license information, please see license.txt

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
	Text/Small Text/Text Editor only -- not Code, JSON, or EditorJS lesson bodies."""
	if not isinstance(value, str) or not value:
		return value

	return sanitize_html(value, disallowed_tags=FORM_CONTROL_TAGS)
