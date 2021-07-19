import frappe

def get_context(context):
    context.no_cache = 1
    context.courses = get_courses()

def get_courses():
    course_names = frappe.get_all("LMS Course", filters={"is_published": True}, pluck="name")
    courses = []
    for course in course_names:
        courses.append(frappe.get_doc("LMS Course", course))
    return courses
