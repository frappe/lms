import frappe

def get_context(context):
    context.no_cache = 1

    try:
        course_slug = frappe.form_dict['course']
        topic_slug = frappe.form_dict['topic']
    except KeyError:
        context.template = 'www/404.html'
        return

    course = get_course(course_slug)
    topic = course and course.get_topic(topic_slug)

    if not topic:
        context.template = 'www/404.html'
        return

    context.course = course
    context.topic = topic
    context.livecode_url = get_livecode_url()

def notfound(context):
    context.template = 'www/404.html'

def get_livecode_url():
    doc = frappe.get_doc("LMS Settings")
    return doc.livecode_url

def get_course(slug):
    course = frappe.db.get_value('LMS Course', {"slug": slug}, ["name"], as_dict=1)
    return course and frappe.get_doc('LMS Course', course['name'])
