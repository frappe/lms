import frappe

def get_context(context):
    context.no_cache = 1

    username = frappe.form_dict.get('username')
    user = username and get_user(username)
    if not user:
        context.template = "www/404.html"

    user.abbr = "".join([s[0] for s in user.full_name.split()])
    context.user = user

def get_user(username):
    try:
        return frappe.get_doc("Community Member", username)
    except frappe.DoesNotExistError:
        return
