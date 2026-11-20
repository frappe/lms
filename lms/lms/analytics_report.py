# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""The course and batch dashboards' analytics export: one report, rendered as Excel, PDF or HTML."""

import re

import frappe
from frappe import _
from frappe.utils.jinja_globals import is_rtl
from frappe.utils.pdf import get_pdf
from frappe.utils.xlsxutils import handle_html, make_xlsx

REPORT_TEMPLATE = "lms/templates/analytics_report.html"
# A cell starting with one of these is run as a formula by spreadsheet apps.
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")
SHEET_COLUMN_WIDTH = 18
# The image is one tall picture, so it shows the newest students and points to the files for the rest.
IMAGE_STUDENTS = 60
PREVIEW_STUDENTS = 25


def send_analytics(report: frappe._dict, file_format: str) -> None:
	"""Answer the request with the report as `<name>-analytics.<xlsx|pdf>`."""
	filename = f"{re.sub(r'[^A-Za-z0-9_-]+', '-', report.name)}-analytics.{file_format}"
	frappe.response.filename = filename
	if file_format == "pdf":
		frappe.response.filecontent = report_pdf(report)
		frappe.response.type = "pdf"
	else:
		frappe.response.filecontent = report_xlsx(report)
		frappe.response.type = "binary"


def report_sheet(report: frappe._dict, max_students: int | None = None) -> list[list]:
	"""The title, time frame and headline numbers, then the student header and a row per student."""
	rows = report.sheet_rows if max_students is None else report.sheet_rows[:max_students]
	return [
		[report.title],
		[_("Time frame"), report.time_frame],
		[_("Generated on"), report.generated_on],
		[],
		*([f"{kpi['label']} (%)" if kpi["suffix"] else kpi["label"], kpi["value"]] for kpi in report.kpis),
		[],
		report.sheet_header,
		*([sheet_cell(cell) for cell in row] for row in rows),
	]


def report_xlsx(report: frappe._dict) -> bytes:
	widths = [SHEET_COLUMN_WIDTH] * len(report.sheet_header)
	return make_xlsx(report_sheet(report), _("Analytics"), column_widths=widths).getvalue()


def report_pdf(report: frappe._dict) -> bytes:
	html = (
		f'<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>{report_html(report)}</body></html>'
	)
	return get_pdf(html, {"page-size": "A4", "orientation": "Portrait"})


def report_html(report: frappe._dict, max_students: int | None = None, hidden_note: str | None = None) -> str:
	"""The report as one self-contained, inline-styled element: wkhtmltopdf and an SVG image both draw it.

	`hidden_note` replaces the line under a capped student table; `{0}` is how many it left out."""
	rows = report.table_rows if max_students is None else report.table_rows[:max_students]
	hidden_rows = len(report.table_rows) - len(rows)
	note = hidden_note or _("And {0} more. Export as Excel or PDF for every student.")
	return frappe.render_template(  # nosemgrep: frappe-ssti - a fixed template file of this app
		REPORT_TEMPLATE,
		{
			"report": report,
			"rows": rows,
			"hidden_note": note.format(hidden_rows) if hidden_rows else "",
			"rtl": is_rtl(),
		},
	)


def report_preview(report: frappe._dict, file_format: str) -> dict:
	"""What the export holds, capped so that a large course is still a small reply."""
	students = len(report.table_rows)
	if file_format == "png":
		html = report_html(report, IMAGE_STUDENTS)
		return {"students": students, "shown": min(students, IMAGE_STUDENTS), "html": html, "sheet": None}
	shown = min(students, PREVIEW_STUDENTS)
	if file_format == "pdf":
		html = report_html(report, PREVIEW_STUDENTS, _("And {0} more in the PDF."))
		return {"students": students, "shown": shown, "html": html, "sheet": None}
	rows = report_sheet(report, PREVIEW_STUDENTS)
	sheet = {
		# The cells as make_xlsx writes them, so a name holding markup reads the same in both.
		"rows": [[handle_html(cell) if isinstance(cell, str) else cell for cell in row] for row in rows],
		"header_row": len(rows) - shown - 1,
		"columns": len(report.sheet_header),
	}
	return {"students": students, "shown": shown, "html": None, "sheet": sheet}


def sheet_cell(value):
	if value is None:
		return ""
	if isinstance(value, str) and value.startswith(FORMULA_PREFIXES):
		return f"'{value}"
	return value
