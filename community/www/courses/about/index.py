import frappe
from community.www.courses.utils import redirect_if_not_a_member, get_course, get_instructor, get_batch

def get_context(context):
    context.no_cache = 1
    context.course_slug = frappe.form_dict["course"]
    context.course = get_course(context.course_slug)
    context.batch_code = frappe.form_dict["batch"]
    redirect_if_not_a_member(context.course_slug, context.batch_code)

    context.instructor = get_instructor(context.course.owner)
    context.batch = get_batch(context.batch_code)
    context.mentors = get_mentors(context.batch.name)
    print(context.mentors)

def get_mentors(batch):
    mentors = []
    memberships = frappe.get_all("LMS Batch Membership", {"batch": batch, "member_type": "Mentor"}, ["member"])
    for membership in memberships:
        member = frappe.db.get_value("Community Member", membership.member, ["name","full_name"], as_dict=True)
        member.batch_count = len(frappe.get_all("LMS Batch Membership", {"member": member.name, "member_type": "Mentor"}))
        mentors.append(member)
    return mentors