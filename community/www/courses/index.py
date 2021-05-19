import frappe

def get_context(context):
    context.no_cache = 1
    context.courses = get_courses()
    print(context)

def get_courses():
    courses = frappe.get_all(
        "LMS Course",
        fields=['name', 'title', 'description']
    )
    return courses
