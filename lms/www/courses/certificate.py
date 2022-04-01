import frappe

def get_context(context):
    context.no_cache = 1

    try:
        course_name = frappe.form_dict["course"]
        certificate_name = frappe.form_dict["certificate"]
    except KeyError:
        redirect_to_course_list()

    context.certificate = frappe.db.get_value("LMS Certificate", certificate_name,
                ["name", "student", "issue_date", "expiry_date", "course"], as_dict=True)

    if context.certificate.course != course_name:
        redirect_to_course_list()

    context.course = frappe.db.get_value("LMS Course", course_name,
                ["instructor", "title", "name"], as_dict=True)

    context.instructor = frappe.db.get_value("User", context.course.instructor,
                ["full_name", "username"], as_dict=True)

    context.student = frappe.db.get_value("User", context.certificate.student,
                ["full_name"], as_dict=True)

    context.logo = frappe.db.get_single_value("Website Settings", "banner_image")

def redirect_to_course_list():
    frappe.local.flags.redirect_location = "/courses"
    raise frappe.Redirect
