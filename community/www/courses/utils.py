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
        return frappe.db.get_value("LMS Batch", {"code": code}, "name")
    except frappe.DoesNotExistError:
        return

def is_member_of_batch(batch_code):
    membership = frappe.get_all("LMS Batch Membership", {"batch": get_batch(batch_code), "member": get_member_with_email()})
    if len(membership):
        return True
    return False

def redirect_if_not_a_member(course,batch_code):
    if not is_member_of_batch(batch_code):
        frappe.local.flags.redirect_location = "/courses/" + course
        raise frappe.Redirect

def get_course(slug):
    try:
        return frappe.db.get_value("LMS Course", {"slug": slug}, "name", as_dict=True)
    except frappe.DoesNotExistError:
        return