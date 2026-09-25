import frappe

AI_ENGINE_ROLE = "AI Engine"


def after_install():
	ensure_roles()


def after_migrate():
	ensure_roles()


def ensure_roles():
	"""Create the AI Engine role without granting it any DocType permission.

	The role only unlocks the ``engine`` tools of :mod:`lms.copilot.tools`,
	which can create proposals and drafts but never write to LMS records. It must
	not receive Custom DocPerm rows: those replace the standard permissions of the
	LMS DocType they touch and once blocked students from submitting assignments.
	"""
	if frappe.db.exists("Role", AI_ENGINE_ROLE):
		return
	frappe.get_doc(
		{
			"doctype": "Role",
			"role_name": AI_ENGINE_ROLE,
			"desk_access": 0,
		}
	).insert(ignore_permissions=True)
