import frappe

def get_course(course_name=None):
    course_name = course_name or frappe.form_dict["course"]
    return course_name and get_doc("LMS Course", course_name)

def get_doc(doctype, name):
    try:
        return frappe.get_doc(doctype, name)
    except frappe.exceptions.DoesNotExistError:
        return

def add_nav(context, title, href):
    """Adds a breadcrumb to the navigation.
    """
    nav = context.setdefault("nav", [])
    nav.append({"title": title, "href": href})
