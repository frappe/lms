"""
M1 · One-Click Batch Assignment
Assigns a list of users to an LMS Batch in a single API call.
Enrolled via LMS Batch Enrollment; skips existing members.
Logs every operation to LMS Import Job for audit.
"""

import json

import frappe
from frappe import _


@frappe.whitelist()
def assign_users_to_batch(batch_name, user_list):
	"""
	Assigns a list of users to a given LMS Batch.
	Called after bulk import completes.
	Skips users already enrolled to avoid duplicates.

	Args:
	    batch_name (str): The name of the LMS Batch document.
	    user_list (str | list): JSON string or Python list of user email IDs.

	Returns:
	    dict: {"assigned": int, "skipped": int, "errors": list}
	"""
	_require_moderator_or_above()

	if isinstance(user_list, str):
		user_list = json.loads(user_list)

	if not user_list:
		frappe.throw(_("No users provided for batch assignment."))

	# Validate batch exists
	if not frappe.db.exists("LMS Batch", batch_name):
		frappe.throw(_("Batch {0} does not exist.").format(batch_name))

	# Fetch already enrolled members for this batch
	existing_members = set(
		frappe.db.get_all(
			"LMS Batch Enrollment",
			filters={"batch": batch_name},
			pluck="member",
		)
	)

	added = 0
	skipped = 0
	errors = []

	for user in user_list:
		user = user.strip()
		if not user:
			continue

		if user in existing_members:
			skipped += 1
			continue

		# Create user as Website User if they don't exist yet
		if not frappe.db.exists("User", user):
			try:
				new_user = frappe.get_doc(
					{
						"doctype": "User",
						"email": user,
						"first_name": user.split("@")[0].replace(".", " ").replace("_", " ").title(),
						"user_type": "Website User",
						"send_welcome_email": 0,
					}
				)
				new_user.insert(ignore_permissions=True)
			except Exception as e:
				errors.append("Could not create user {}: {}".format(user, str(e)))
				continue

		try:
			enrollment = frappe.get_doc(
				{
					"doctype": "LMS Batch Enrollment",
					"batch": batch_name,
					"member": user,
				}
			)
			enrollment.insert(ignore_permissions=True)
			existing_members.add(user)
			added += 1
		except Exception as e:
			errors.append(_("Error enrolling {0}: {1}").format(user, str(e)))

	# Determine status
	if errors and added == 0:
		status = "Failed"
	elif errors or skipped:
		status = "Partial"
	else:
		status = "Success"

	# Log the import job
	frappe.get_doc(
		{
			"doctype": "LMS Import Job",
			"batch": batch_name,
			"import_date": frappe.utils.now(),
			"total_users": len(user_list),
			"assigned_count": added,
			"status": status,
			"error_log": "\n".join(errors) if errors else None,
		}
	).insert(ignore_permissions=True)

	frappe.db.commit()

	return {
		"assigned": added,
		"skipped": skipped,
		"errors": errors,
		"status": status,
	}


@frappe.whitelist()
def get_batch_list():
	"""Returns a list of all published LMS Batches for the batch selector dropdown."""
	return frappe.get_all(
		"LMS Batch",
		filters={"published": 1},
		fields=["name", "title"],
		order_by="title asc",
	)


def _require_moderator_or_above():
	roles = frappe.get_roles(frappe.session.user)
	allowed = {"Moderator", "Course Creator", "System Manager"}
	if not allowed.intersection(roles):
		frappe.throw(
			_("Only Moderators or Course Creators can perform batch assignments."),
			frappe.PermissionError,
		)
