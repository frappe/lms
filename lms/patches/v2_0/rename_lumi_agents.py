import frappe

OLD_QUERIES = "lms/Learning Tutor"  # answered questions under this name until now
OLD_TUTOR = "lms/Learning Teacher"
QUERIES = "lms/Learning Queries"
TUTOR = "lms/Learning Tutor"

# Every field that points at an agent, so old sessions and memories follow their agent.
LINKS = (("Flow Session", "agent"), ("Flow Agent Memory", "agent"), ("Flow Trigger", "agent"))


def execute():
	"""The teaching agent takes the name "Learning Tutor", and the agent that answers questions
	from the material, which held it, becomes "Learning Queries". Flow does not rename an app's
	agents, so the agents are written under their new names, everything that pointed at the old
	ones is moved across, and "Learning Teacher" is deleted. Each keeps the model the site chose."""
	if not frappe.db.exists("DocType", "Flow Agent") or not frappe.db.exists("Flow Agent", OLD_TUTOR):
		return
	from lms.lms.ai import setup

	models = {
		QUERIES: frappe.db.get_value("Flow Agent", OLD_QUERIES, "model"),
		TUTOR: frappe.db.get_value("Flow Agent", OLD_TUTOR, "model"),
	}
	# Read both sets of names before anything moves: the first move puts sessions under the name
	# the second one empties.
	moves = {
		QUERIES: {doctype: _linked(doctype, field, OLD_QUERIES) for doctype, field in LINKS},
		TUTOR: {doctype: _linked(doctype, field, OLD_TUTOR) for doctype, field in LINKS},
	}
	setup.ensure_agents()
	for agent, model in models.items():
		if model and frappe.db.exists("Flow Model", model):
			frappe.db.set_value("Flow Agent", agent, "model", model, update_modified=False)
	for agent, by_doctype in moves.items():
		for (doctype, field), names in zip(LINKS, by_doctype.values(), strict=True):
			if names:
				frappe.db.set_value(doctype, {"name": ("in", names)}, field, agent, update_modified=False)
	# nosemgrep: lms-unjustified-ignore-permissions - a patch removing the app's own agent; Flow lets only the owning app delete it
	frappe.delete_doc("Flow Agent", OLD_TUTOR, ignore_permissions=True, force=True)


def _linked(doctype: str, field: str, agent: str) -> list[str]:
	if not frappe.db.exists("DocType", doctype):
		return []
	return frappe.get_all(doctype, filters={field: agent}, pluck="name")
