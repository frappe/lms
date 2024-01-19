import frappe


def execute():
	roles = ["LMS Student", "Moderator", "Course Creator", "Class Evaluator"]
	for role in roles:
		add_perm_for_discussion_topic(role)
		add_perm_for_discussion_reply(role)


def add_perm_for_discussion_topic(role):
	topic_roles = frappe.permissions.get_doctype_roles("Discussion Topic")
	if role in topic_roles:
		return

	topic_perm = frappe.new_doc("Custom DocPerm")
	topic_perm.parent = "Discussion Topic"
	topic_perm.role = role
	topic_perm.if_owner = 1
	topic_perm.read = 1
	topic_perm.write = 1
	topic_perm.create = 1
	topic_perm.delete = 1
	topic_perm.insert()
	frappe.db.commit()


def add_perm_for_discussion_reply(role):
	reply_roles = frappe.permissions.get_doctype_roles("Discussion Reply")
	if role in reply_roles:
		return

	reply_perm = frappe.new_doc("Custom DocPerm")
	reply_perm.parent = "Discussion Reply"
	reply_perm.role = role
	reply_perm.if_owner = 1
	reply_perm.read = 1
	reply_perm.write = 1
	reply_perm.create = 1
	reply_perm.delete = 1
	reply_perm.insert()
	frappe.db.commit()
