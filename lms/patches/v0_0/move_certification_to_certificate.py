import frappe

def execute():
    old = frappe.get_all("LMS Certification", fields=["name", "course", "student", "issue_date", "expiry_date"])
    for data in old:
        frappe.get_doc({
            "doctype": "LMS Certificate",
            "course": data.course,
            "member": data.student,
            "issue_date": data.issue_date,
            "expiry_date": data.expiry_date
        }).save(ignore_permissions=True)
