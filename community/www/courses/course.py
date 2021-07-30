import frappe

def get_context(context):
    context.no_cache = 1

    try:
        course_name = frappe.form_dict["course"]
    except KeyError:
        frappe.local.flags.redirect_location = "/courses"
        raise frappe.Redirect

    course = frappe.get_doc("LMS Course", course_name)
    if course is None:
        frappe.local.flags.redirect_location = "/courses"
        raise frappe.Redirect

    context.course = course
    membership = course.get_membership(frappe.session.user)
    context.course.query_parameter = "?batch=" + membership.batch if membership and membership.batch else ""
    context.membership = membership
    context.metatags = {
        "title": course.title,
        "image": course.image,
        "description": course.short_introduction,
        "keywords": course.title
    }
