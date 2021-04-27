import frappe
from community.www.courses.utils import get_instructor
from frappe.utils import nowdate, getdate

def get_context(context):
    context.no_cache = 1
    
    try:
        course_id = frappe.form_dict["course"]
    except KeyError:
        frappe.local.flags.redirect_location = "/courses"
        raise frappe.Redirect
    
    context.course = get_course(course_id)
    context.batches = get_course_batches(context.course.name)
    context.is_mentor = is_mentor(context.course.name)
    context.memberships = get_membership(context.batches)
    if len(context.memberships) and not context.is_mentor:
        frappe.local.flags.redirect_location = "/courses/" + course_id + "/" + context.memberships[0].code + "/learn"
        raise frappe.Redirect
    context.upcoming_batches = get_upcoming_batches(context.course.name)
    context.instructor = get_instructor(context.course.owner)
    context.mentors = get_mentors(context.course.name)
    
    if context.is_mentor:
        context.mentor_batches = get_mentor_batches(context.memberships)        # Your Bacthes for mentor

def get_course(slug):
    course = frappe.db.get_value("LMS Course", {"slug": slug},
        ["name", "slug", "title", "description", "short_introduction", "video_link", "owner"], as_dict=1)

    course["topics"] = frappe.db.get_all("LMS Topic",
        filters={
            "course": course["name"]
        },
        fields=["name", "slug", "title", "preview"],
        order_by="creation"
    )
    return course

def get_upcoming_batches(course):
    batches = frappe.get_all("LMS Batch", {"course": course, "start_date": [">", nowdate()]}, ["start_date", "start_time", "end_time", "sessions_on", "name"])
    batches = get_batch_mentors(batches)
    return batches

def get_batch_mentors(batches):
    for batch in batches:
        batch.mentors = []
        mentors = frappe.get_all("LMS Batch Membership", {"batch": batch.name, "member_type": "Mentor"}, ["member"])
        for mentor in mentors:
            member = frappe.db.get_value("Community Member", mentor.member, ["full_name", "photo", "abbr"], as_dict=1)
            batch.mentors.append(member)
    return batches

def get_membership(batches):
    memberships = []
    member = frappe.db.get_value("Community Member", {"email": frappe.session.user}, "name")
    for batch in batches:
        membership = frappe.db.get_value("LMS Batch Membership", {"member": member, "batch": batch.name}, ["batch", "member", "member_type"], as_dict=1)
        if membership:
            membership.code = batch.code
            memberships.append(membership)
    return memberships

def get_mentors(course):
    course_mentors = []
    mentors = frappe.get_all("LMS Course Mentor Mapping", {"course": course}, ["mentor"])
    for mentor in mentors:
        member = frappe.get_doc("Community Member", mentor.mentor)
        member.batch_count = len(frappe.get_all("LMS Batch Membership", {"member": member.name, "member_type": "Mentor"}))
        course_mentors.append(member)
    return course_mentors

def get_course_batches(course):
    return frappe.get_all("LMS Batch", {"course": course}, ["name", "code"])

def get_mentor_batches(memberships):
    mentor_batches = []
    memberships_as_mentor = list(filter(lambda x: x.member_type == "Mentor", memberships))
    for membership in memberships_as_mentor:
        batch = frappe.get_doc("LMS Batch", membership.batch)
        mentor_batches.append(batch)
    for batch in mentor_batches:
        if getdate(batch.start_date) < getdate():
            batch.status = "active"
            batch.badge_class = "green_badge"
        else:
            batch.status = "scheduled"
            batch.badge_class = "yellow_badge"
    mentor_batches = get_batch_mentors(mentor_batches)
    return mentor_batches

def is_mentor(course):
    try:
        member = frappe.db.get_value("Community Member", {"email": frappe.session.user}, ["name"])
    except frappe.DoesNotExistError:
        return False
    mapping = frappe.get_all("LMS Course Mentor Mapping", {"course": course, "mentor": member})
    if len(mapping):
        return True

