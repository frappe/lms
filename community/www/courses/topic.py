import frappe

def get_context(context):
    context.no_cache = 1
    course_name = get_queryparam("course", '/courses')
    context.course = get_course(course_name)

    topic_name = get_queryparam("topic", '/courses?course=' + course_name)
    context.topic = get_topic(course_name, topic_name)

def get_queryparam(name, redirect_when_not_found):
    try:
        return frappe.form_dict[name]
    except KeyError:
        frappe.local.flags.redirect_location = redirect_when_not_found
        raise frappe.Redirect

def get_course(name):
    try:
        course = frappe.get_doc('Community Course', name)
    except frappe.exceptions.DoesNotExistError:
        raise frappe.NotFound
    return course

def get_topic(course_name, topic_name):
    try:
        topic = frappe.get_doc('Community Course Topic', topic_name)
    except frappe.exceptions.DoesNotExistError:
        raise frappe.NotFound
    if topic.course != course_name:
        raise frappe.NotFound
    return topic
