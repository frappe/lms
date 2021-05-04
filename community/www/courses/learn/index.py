import frappe
from community.www.courses.utils import redirect_if_not_a_member

def get_context(context):
    context.no_cache = 1
    context.course = frappe.form_dict["course"]
    context.batch_code = frappe.form_dict["batch"]
    redirect_if_not_a_member(context.course, context.batch_code)
