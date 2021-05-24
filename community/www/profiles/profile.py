import frappe
from community.lms.models import Sketch

def get_context(context):
    context.no_cache = 1
    try:
        context.member = frappe.get_doc("User", {"username": frappe.form_dict["username"]})
    except:
        context.template = "www/404.html"
    else:
        context.sketches = Sketch.get_recent_sketches(owner=context.member.email)
