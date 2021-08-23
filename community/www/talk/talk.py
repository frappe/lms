import frappe


def get_context(context):
    context.no_cache = 1
    talk = None

    try:
        talk = frappe.form_dict["talk"]
    except KeyError:
        frappe.local.flags.redirect_location = "/talk"
        raise frappe.Redirect

    context.talk = frappe.get_doc("Talk", talk)
    context.talks = frappe.get_all("Talk")
