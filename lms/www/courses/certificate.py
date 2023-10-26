import frappe
from frappe import _
from frappe.utils.jinja import render_template
from frappe.utils import get_url
from lms.lms.utils import has_course_moderator_role


def get_context(context):
	context.no_cache = 1

	try:
		course_name = frappe.form_dict["course"]
		certificate_name = frappe.form_dict["certificate"]
	except KeyError:
		redirect_to_course_list()

	context.doc = frappe.db.get_value(
		"LMS Certificate",
		certificate_name,
		["name", "member", "issue_date", "expiry_date", "course", "template"],
		as_dict=True,
	)

	if context.doc.course != course_name:
		redirect_to_course_list()

	context.course = frappe.db.get_value(
		"LMS Course", course_name, ["title", "name", "image"], as_dict=True
	)
	context.member = frappe.db.get_value(
		"User", context.doc.member, ["full_name", "username"], as_dict=True
	)
	context.url = f"{get_url()}/courses/{context.course.name}/{context.doc.name}"
	context.is_moderator = has_course_moderator_role()

	if context.doc.template:
		print_format = context.doc.template
	else:
		print_format = get_print_format()

	context.print_format = print_format
	template = frappe.db.get_value(
		"Print Format", print_format, ["html", "css"], as_dict=True
	)
	merged_template = "<style> " + template.css + " </style>" + template.html
	final_template = render_template(merged_template, context)
	context.final_template = final_template


def redirect_to_course_list():
	frappe.local.flags.redirect_location = "/courses"
	raise frappe.Redirect


def get_print_format():
	print_format = None
	default = frappe.db.get_value(
		"Property Setter",
		{
			"doc_type": "LMS Certificate",
			"property": "default_print_format",
		},
		"value",
	)

	if frappe.db.exists("Print Format", default):
		print_format = default

	if not print_format and frappe.db.exists("Print Format", "Certificate"):
		print_format = "Certificate"

	if not print_format:
		raise ValueError(
			_(
				"Default Print Format is not set for Certificate. Please contact the Administrator."
			)
		)

	return print_format
