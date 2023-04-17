import frappe
from frappe.utils.jinja import render_template
from frappe.utils import get_url
from lms.lms.utils import get_instructors


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
		["name", "member", "issue_date", "expiry_date", "course"],
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

	default_print_format = frappe.db.get_value(
		"Property Setter",
		{
			"doc_type": "LMS Certificate",
			"property": "default_print_format",
		},
		["value"],
		as_dict=True,
	)

	template = frappe.db.get_value(
		"Print Format", default_print_format.value, ["html", "css"], as_dict=True
	)
	final_template = "<style> " + template.css + " </style>" + template.html
	context.final_template = render_template(final_template, context)


def redirect_to_course_list():
	frappe.local.flags.redirect_location = "/courses"
	raise frappe.Redirect
