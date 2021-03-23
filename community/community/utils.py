import frappe

def create_members_from_users():
	users = frappe.get_all("User", ["email"])
	for user in users:
		if not frappe.db.get_value("Community Member", {"email": user.email}, "name"):
			doc = frappe.get_doc("User", {"email": user.email})
			username = doc.username if doc.username and len(doc.username) > 3 else ("").join([ s for s in doc.full_name.split() ])
			if not frappe.db.exists("Community Member", username):
				member = frappe.get_doc({
					"doctype": "Community Member",
					"full_name": doc.full_name,
					"username": username,
					"email": doc.email,
					"route": doc.username,
					"owner": doc.email
				})
				member.save(ignore_permissions=True)