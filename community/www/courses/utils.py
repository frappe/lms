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
        print("get_batch", code)
        return frappe.db.get_value("LMS Batch", {"name": code}, ["name", "description"], as_dict=True)
    except frappe.DoesNotExistError:
        print("Error: notfound")
        return

def is_member_of_batch(batch_code):
    membership = frappe.get_all("LMS Batch Membership", {"batch": batch_code, "member": get_member_with_email()})
    if len(membership):
        return True
    return False

def redirect_if_not_a_member(course,batch_code):
    if not is_member_of_batch(batch_code):
        frappe.local.flags.redirect_location = "/courses/" + course
        raise frappe.Redirect

def get_course(name):
    try:
        return frappe.get_doc("LMS Course", {"name": name})
    except frappe.DoesNotExistError:
        return

def get_batch_members(batch):
    members = []
    memberships = frappe.get_all("LMS Batch Membership", {"batch": batch}, ["member", "member_type"])

    for membership in memberships:
        member = get_member_with_name(membership.member)
        if membership.member_type == "Mentor":
            member.is_mentor = True
        members.append(member)
    return members
