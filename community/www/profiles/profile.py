import frappe
from community.page_renderers import get_profile_url_prefix
from urllib.parse import urlencode

def get_context(context):
    context.no_cache = 1

    try:
        username = frappe.form_dict["username"]
    except KeyError:
        username = frappe.db.get_value("User", frappe.session.user, ["username"])
        if username:
            print(username)
            frappe.local.flags.redirect_location = get_profile_url_prefix() + urlencode({"username": username})
            raise frappe.Redirect
    try:
        context.member = frappe.get_doc("User", {"username": username})
    except:
        context.template = "www/404.html"
        return
    print(context.member)
    context.profile_tabs = get_profile_tabs(context.member)

def get_profile_tabs(user):
    """Returns the enabled ProfileTab objects.

    Each ProfileTab is rendered as a tab on the profile page and the
    they are specified as profile_tabs hook.
    """
    tabs = frappe.get_hooks("profile_tabs") or []
    return [frappe.get_attr(tab)(user) for tab in tabs]
