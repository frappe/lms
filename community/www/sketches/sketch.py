import frappe

def get_context(context):
    context.no_cache = 1
    course_name = get_queryparam("sketch", '/sketches')
    context.sketch = get_sketch(course_name)
    context.livecode_url = get_livecode_url()
    context.editable = is_editable(context.sketch, frappe.sesson.user)

def is_editable(sketch, user):
    if sketch.name == "new":
        # new sketches can be editable by any logged in user
        return user != "Guest"
    else:
        # existing sketches are editable by the owner
        return sketch.owner == user

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
    if name == 'new':
        sketch = frappe.new_doc('LMS Sketch')
        sketch.name = "new"
        sketch.title = "New Sketch"
        sketch.code = "circle(100, 100, 50)"
        return sketch

    try:
        return frappe.get_doc('LMS Sketch', name)
    except frappe.exceptions.DoesNotExistError:
        raise frappe.NotFound

