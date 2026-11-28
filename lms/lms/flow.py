import frappe

# The event the LMS pages of the user Flow acts for listen to.
FLOW_CHANGE_EVENT = "lms_flow_change"
# The fields a record's LMS page is addressed by besides its name (frontend/src/utils/recordRoutes.ts).
ROUTE_FIELDS = ("course", "batch", "batch_name", "assignment", "exercise", "username")


def is_flow_request() -> bool:
	"""Whether Flow's agent is acting for the user in this request (frappe.auth.set_agent)."""
	agent = frappe.session.data.get("agent") if frappe.session else None
	return bool(agent) and agent.get("via") == "Flow"


def publish_flow_change(doc, method=None):
	"""Tells the LMS pages of the user Flow acts for which record it changed, so they refresh or open it."""
	if doc.meta.istable or not is_flow_request() or frappe.get_doctype_app(doc.doctype) != "lms":
		return
	frappe.publish_realtime(
		FLOW_CHANGE_EVENT,
		{
			"doctype": doc.doctype,
			"name": doc.name,
			"deleted": method == "on_trash",
			"values": {field: getattr(doc, field) for field in ROUTE_FIELDS if getattr(doc, field, None)},
		},
		user=frappe.session.user,
		after_commit=True,
	)
