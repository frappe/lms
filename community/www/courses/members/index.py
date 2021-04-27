import frappe
from community.www.courses.utils import redirect_if_not_a_member, get_batch, get_member_with_name, get_course, get_batch_members

def get_context(context):
    context.no_cache = 1
    context.course_slug = frappe.form_dict["course"]
    context.course = get_course(context.course_slug)
    context.batch_code = frappe.form_dict["batch"]
    redirect_if_not_a_member(context.course_slug, context.batch_code)
    context.batch = get_batch(context.batch_code)
    context.members = get_batch_members(context.batch.name)
    context.member_count = len(context.members)