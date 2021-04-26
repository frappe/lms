import frappe
from community.www.courses.utils import redirect_if_not_a_member, get_batch, get_member_with_name, get_course

def get_context(context):
    context.no_cache = 1
    context.course_slug = frappe.form_dict["course"]
    context.course = get_course(context.course_slug)
    context.batch_code = frappe.form_dict["batch"]
    redirect_if_not_a_member(context.course_slug, context.batch_code)
    context.batch = get_batch(context.batch_code)
    context.members = get_members(context.batch)
    context.member_count = len(context.members)

def get_members(batch):
    members = []
    memberships = frappe.get_all("LMS Batch Membership", {"batch": batch}, ["member", "member_type"])

    for membership in memberships:
        member = get_member_with_name(membership.member)
        if membership.member_type == "Mentor":
            member.is_mentor = True
        members.append(member)
    return members