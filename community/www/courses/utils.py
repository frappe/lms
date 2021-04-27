import frappe

def get_member_with_email():
    try:
        return frappe.db.get_value("Community Member", {"email": frappe.session.user}, "name")
    except frappe.DoesNotExistError:
        return

def get_member_with_name(name):
    try:
        return frappe.get_doc("Community Member", name)
    except frappe.DoesNotExistError:
        return

def get_batch(code):
    try:
        return frappe.db.get_value("LMS Batch", {"code": code}, ["name", "description"], as_dict=True)
    except frappe.DoesNotExistError:
        return

def is_member_of_batch(batch_code):
    membership = frappe.get_all("LMS Batch Membership", {"batch": get_batch(batch_code).name, "member": get_member_with_email()})
    if len(membership):
        return True
    return False

def redirect_if_not_a_member(course,batch_code):
    if not is_member_of_batch(batch_code):
        frappe.local.flags.redirect_location = "/courses/" + course
        raise frappe.Redirect

def get_course(slug):
    try:
        return frappe.get_doc("LMS Course", {"slug": slug})
    except frappe.DoesNotExistError:
        return

def get_instructor(owner):
    instructor = frappe._dict()
    try:
        instructor = frappe.get_doc("Community Member", {"email": owner})
    except frappe.DoesNotExistError:
        instructor.full_name = owner
        instructor.abbr = ("").join([ s[0] for s in owner.split() ])
    instructor.course_count = len(frappe.get_all("LMS Course", {"owner": owner}))
    return instructor

def get_batch_members(batch):
    members = []
    memberships = frappe.get_all("LMS Batch Membership", {"batch": batch}, ["member", "member_type"])

    for membership in memberships:
        member = get_member_with_name(membership.member)
        if membership.member_type == "Mentor":
            member.is_mentor = True
        members.append(member)
    return members