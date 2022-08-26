import frappe

def get_context(context):
    context.quiz_list = frappe.get_all("LMS Quiz", {"owner": frappe.session.user}, ["name", "title"])
