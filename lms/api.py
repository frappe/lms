import frappe

@frappe.whitelist(allow_guest=True)
def check_enrollment_status(course):
    """Check if user is enrolled and return enrollment request option"""
    if frappe.session.user == "Guest":
        return {
            "enrolled": False,
            "show_request": False,
            "login_required": True
        }
    
    # Check enrollment
    enrolled = frappe.db.exists("LMS Enrollment", {
        "course": course,
        "student": frappe.session.user
    })
    
    # Check pending request
    pending_request = frappe.db.exists("Course Enrollment Request", {
        "course": course,
        "student_email": frappe.session.user,
        "status": "Pending"
    })

@frappe.whitelist()
def get_enrollment_form_data(course=None):
    '''Get pre-filled data for enrollment request form'''
    if frappe.session.user == "Guest":
        return {}
    
    user = frappe.get_doc("User", frappe.session.user)
    
    return {
        "course": course,
        "student_email": frappe.session.user,
        "student_name": user.full_name or user.first_name,
        "request_date": frappe.utils.today(),
        "status": "Pending"
    }



    
    
    return {
        "enrolled": bool(enrolled),
        "show_request": not enrolled and not pending_request,
        "pending_request": bool(pending_request),
        "request_url": f"/request-enrollment?course={course}"
    }



@frappe.whitelist()
def test_api():
    return {"status": "ok"}
