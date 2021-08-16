import frappe

def get_context(context):
    context.no_cache = 1

    try:
        thread_name = frappe.form_dict["discussion"]
    except KeyError:
        redirect_to_discussions()

    context.thread = frappe.db.get_value("Discussion Thread", thread_name, ["name", "title"], as_dict=True)

    if not len(context.thread):
        redirect_to_discussions

def redirect_to_discussions():
    frappe.local.flags.redirect_location = "/discussions"
    raise frappe.Redirect
