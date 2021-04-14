import frappe
from ...lms.doctype.lms_sketch.lms_sketch import get_recent_sketches

def get_context(context):
    context.no_cache = 1
    context.username = frappe.form_dict['username']
    context.member = frappe.get_doc("Community Member", {"username":context.username})
    context.abbr = "".join([s[0] for s in context.member.full_name.split()])
    context.sketches = list(filter(lambda x: x.owner == context.member.email, get_recent_sketches()))
