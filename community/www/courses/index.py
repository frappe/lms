import frappe

def get_context(context):
    context.no_cache = 1
    context.courses = get_courses()
    context.metatags = {
        "title": "All Courses",
        "image": frappe.db.get_single_value("Website Settings", "banner_image"),
        "description": "This page lists all the courses published on our website",
        "keywords": "All Courses, Courses, Learn"
    }

def get_courses():
    course_names = frappe.get_all("LMS Course", filters={"is_published": True}, order_by="upcoming", pluck="name")
    courses = []
    for course in course_names:
        courses.append(frappe.get_doc("LMS Course", course))
    return courses
