import frappe
from frappe.utils.jinja import render_template
from lms.lms.utils import get_instructors

def get_context(context):
    context.no_cache = 1

    try:
        course_name = frappe.form_dict["course"]
        certificate_name = frappe.form_dict["certificate"]
    except KeyError:
        redirect_to_course_list()

    context.certificate = frappe.db.get_value("LMS Certificate", certificate_name,
                ["name", "member", "issue_date", "expiry_date", "course"], as_dict=True)

    if context.certificate.course != course_name:
        redirect_to_course_list()

    context.course = frappe.db.get_value("LMS Course", course_name, ["title", "name", "image"], as_dict=True)
    context.instructors = (", ").join([x.full_name for x in get_instructors(course_name)])
    context.member = frappe.db.get_value("User", context.certificate.member,
                ["full_name"], as_dict=True)

    context.logo = frappe.db.get_single_value("Website Settings", "banner_image")
    template_name = frappe.db.get_single_value("LMS Settings", "custom_certificate_template")
    context.custom_certificate_template = frappe.db.get_value("Web Template", template_name, "template")
    context.custom_template = render_template(context.custom_certificate_template, context)

def redirect_to_course_list():
    frappe.local.flags.redirect_location = "/courses"
    raise frappe.Redirect
