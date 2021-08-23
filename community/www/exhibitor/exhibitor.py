import frappe


def get_context(context):
    context.no_cache = 1
    exhibitor = None

    try:
        exhibitor= frappe.form_dict["exhibitor"]
    except KeyError:
        frappe.local.flags.redirect_location = "/exhibitor"
        raise frappe.Redirect

    context.exhibitor = frappe.get_doc("Exhibitor", exhibitor)