import frappe

def get_context(context):
    context.no_cache = 1
    course_name = get_queryparam("sketch", '/sketches')
    context.sketch = get_sketch(course_name)
    context.livecode_url = get_livecode_url()

def get_livecode_url():
    doc = frappe.get_doc("LMS Settings")
    return doc.livecode_url

def get_queryparam(name, redirect_when_not_found):
    try:
        return frappe.form_dict[name]
    except KeyError:
        frappe.local.flags.redirect_location = redirect_when_not_found
        raise frappe.Redirect

def get_sketch(name):
    try:
        sketch = frappe.get_doc('LMS Sketch', name)
    except frappe.exceptions.DoesNotExistError:
        raise frappe.NotFound

    sketch.owner = sketch.owner.split("@")[0]
    return sketch
