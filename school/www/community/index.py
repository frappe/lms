import frappe

def get_context(context):
    context.user_count = frappe.db.count("User", {"enabled": True})
    users = frappe.get_all("User",
        {"enabled": True},
        pluck="name",
        start=0,
        page_length=30,
        order_by="creation desc")

    user_details = []
    for user in users:
        details = frappe.get_doc("User", user)
        user_details.append(details)

    context.user_details = user_details
