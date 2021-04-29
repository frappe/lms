import frappe

def create_members_from_users():
	users = frappe.get_all("User", {"enabled": 1}, ["email"])
	for user in users:
		if not frappe.db.get_value("Community Member", {"email": user.email}, "name"):
			doc = frappe.get_doc("User", {"email": user.email})
			username = doc.username if doc.username and len(doc.username) > 3 else ("").join([ s for s in doc.full_name.split() ])
			if not frappe.db.exists("Community Member", username):
				member = frappe.new_doc("Community Member")
				member.full_name = doc.full_name
				member.username = username
				member.email = doc.email
				member.route = username
				member.owner = doc.email
				member.insert(ignore_permissions=True)