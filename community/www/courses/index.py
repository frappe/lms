import frappe

def get_context(context):
    context.no_cache = 1
    context.courses = get_courses()

def get_courses():
    courses = frappe.get_all(
        "LMS Course",
        fields=['name', 'slug', 'title', 'description']
    )
    return courses
