import frappe
from community.lms.models import Sketch

def get_context(context):
    context.no_cache = 1
    context.username = frappe.form_dict["username"]
    print(frappe.form_dict["username"])
    context.member = get_member(context.username)
    print(context.member)
    if not context.member:
        context.template = "www/404.html"
    else:
        context.sketches = list(filter(lambda x: x.owner == context.member.email, Sketch.get_recent_sketches()))

def get_member(username):
    try:
        return frappe.get_doc("Community Member", {"username":username})
    except frappe.DoesNotExistError:
        return
