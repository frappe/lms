import frappe


def execute():
	"""
	Restore system manager perms on doctypes
	"""
	doctypes = ["User", "Event", "Discussion Topic", "Discussion Reply"]

	perm_fields = (
		"read",
		"write",
		"create",
		"delete",
		"submit",
		"cancel",
		"amend",
		"report",
		"export",
		"import",
		"print",
		"email",
		"share",
		"select",
	)

	for doctype in doctypes:
		if not frappe.db.exists("Custom DocPerm", {"parent": doctype}):
			continue

		standard_perms = frappe.get_all(
			"DocPerm",
			fields=["permlevel", "if_owner", *perm_fields],
			filters={"parent": doctype, "role": "System Manager"},
		)

		for standard_perm in standard_perms:
			permlevel = standard_perm.permlevel or 0
			if_owner = standard_perm.if_owner or 0

			custom_perm_name = frappe.db.exists(
				"Custom DocPerm",
				{
					"parent": doctype,
					"role": "System Manager",
					"permlevel": permlevel,
					"if_owner": if_owner,
				},
			)

			if custom_perm_name:
				custom_perm = frappe.get_doc("Custom DocPerm", custom_perm_name)
			else:
				custom_perm = frappe.new_doc("Custom DocPerm")
				custom_perm.update(
					{
						"parent": doctype,
						"parenttype": "DocType",
						"parentfield": "permissions",
						"role": "System Manager",
						"permlevel": permlevel,
						"if_owner": if_owner,
					}
				)

			is_dirty = False
			for field in perm_fields:
				if standard_perm.get(field) and not custom_perm.get(field):
					custom_perm.set(field, 1)
					is_dirty = True

			if not custom_perm_name:
				custom_perm.insert(ignore_permissions=True)
			elif is_dirty:
				custom_perm.save(ignore_permissions=True)

	frappe.clear_cache()
