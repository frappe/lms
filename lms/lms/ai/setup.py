"""The Flow agents Learning uses, and the access learners need to talk to them.

Agents are synced on first use rather than through the `flow_agents` hook: a Flow Agent
needs a Flow Model, and a site has none until an admin adds a provider key.
"""

import frappe
from frappe import _
from frappe.permissions import add_permission, update_permission_property

LEARNER_ROLE = "LMS Student"
from lms.lms.permissions import (
	LEARNING_ADMIN_ROLES as ADMIN_ROLES,  # noqa: E402 - one definition of who runs Learning
)

# Flow names an app's agents `<app>/<title>`; sessions open them by that name.
PLAN_DRAFTER = "lms/Learning Plan Drafter"
TUTOR = "lms/Learning Tutor"
ROLE_PLAY = "lms/Learning Role-play"
GRADER = "lms/Learning Grader"
READINESS = "lms/Learning Readiness Assistant"
TEACHER = "lms/Learning Teacher"
OUTCOME_WRITER = "lms/Learning Outcome Writer"


def _title(agent: str) -> str:
	"""The title an agent is defined with; Flow adds the `lms/` itself."""
	return agent.split("/", 1)[-1]


def chat_model() -> str:
	"""The first enabled Flow Model that is not the knowledge base's embedding model."""
	embedding = frappe.db.get_single_value("Flow Knowledge Settings", "embedding_model")
	filters = {"enabled": 1}
	if embedding:
		filters["name"] = ("!=", embedding)
	model = frappe.db.get_value("Flow Model", filters, "name", order_by="creation asc")
	if not model:
		frappe.throw(
			_("Add a chat model in Flow Model before using AI in Learning."),
			title=_("No AI Model"),
		)
	return model


def ensure_agents() -> None:
	"""Create or refresh Learning's Flow agents, then limit each to the roles that may use it."""
	from frappe.flow.lib.agent import Agent

	from lms.lms.ai import prompts, tools

	# A new agent starts on the tutor's model, which an admin picked for tool use, when there is one.
	model = frappe.db.get_value("Flow Agent", TUTOR, "model") or chat_model()
	definitions = [
		(
			Agent(
				name=_title(PLAN_DRAFTER),
				model=model,
				description="Drafts a learning goal's activities from its sources.",
				instructions=prompts.PLAN_DRAFTER,
				tools=[tools.search_goal_sources, tools.save_goal_plan, tools.save_activity],
				max_iterations=30,
				auto_approve=True,
			),
			ADMIN_ROLES,
		),
		(
			Agent(
				name=_title(TUTOR),
				model=model,
				description="Answers a learner's questions from their goal's sources.",
				instructions=prompts.TUTOR,
				tools=[tools.search_my_goal_sources],
				max_iterations=12,
				auto_approve=True,
			),
			(LEARNER_ROLE, *ADMIN_ROLES),
		),
		(
			Agent(
				name=_title(TEACHER),
				model=model,
				description="Teaches a learner one to one, starting from what they already know.",
				instructions=prompts.TEACHER,
				tools=[
					tools.search_my_goal_sources,
					tools.show_moment,
					tools.confirm_idea,
					tools.finish_teaching,
				],
				max_iterations=12,
				auto_approve=True,
			),
			(LEARNER_ROLE, *ADMIN_ROLES),
		),
		(
			Agent(
				name=_title(ROLE_PLAY),
				model=model,
				description="Plays a character in a learning role-play.",
				instructions=prompts.ROLE_PLAY,
				max_iterations=4,
				auto_approve=True,
			),
			(LEARNER_ROLE, *ADMIN_ROLES),
		),
		(
			Agent(
				name=_title(GRADER),
				model=model,
				description="Grades a role-play transcript against its rubric.",
				instructions=prompts.GRADER,
				tools=[tools.submit_grade],
				max_iterations=6,
				auto_approve=True,
			),
			("System Manager",),
		),
		(
			Agent(
				name=_title(READINESS),
				model=model,
				description="Answers questions about who is ready for which learning goal.",
				instructions=prompts.READINESS,
				tools=[tools.readiness_summary, tools.list_assignments],
				max_iterations=12,
				auto_approve=True,
			),
			ADMIN_ROLES,
		),
		(
			Agent(
				name=_title(OUTCOME_WRITER),
				model=model,
				description="Suggests what a skill's learners should be able to do, from its material.",
				instructions=prompts.OUTCOME_WRITER,
				tools=[tools.save_suggested_outcome],
				max_iterations=4,
				auto_approve=True,
			),
			ADMIN_ROLES,
		),
	]
	for agent, roles in definitions:
		agent.sync()
		doc = frappe.get_doc("Flow Agent", agent.name)
		doc.set("roles", [{"role": role} for role in roles])
		doc.save(ignore_permissions=True)


def ensure_learner_access() -> None:
	"""Let learners hold Flow sessions of their own without desk access, as Flow Users do."""
	if not frappe.db.exists("Role", LEARNER_ROLE) or not frappe.db.exists("DocType", "Flow Session"):
		return  # a framework without Flow has nothing to open up; Learning still installs
	rights = {
		"Flow Session": ("read", "write", "create"),
		"Flow Run": ("read",),
		"Flow Agent": ("read",),
		"Flow Model": ("read",),
	}
	owned = ("Flow Session", "Flow Run")
	for doctype, ptypes in rights.items():
		if not frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": LEARNER_ROLE, "permlevel": 0}):
			add_permission(doctype, LEARNER_ROLE, 0, "read")
		for ptype in ptypes:
			update_permission_property(doctype, LEARNER_ROLE, 0, ptype, 1)
		if doctype in owned:
			update_permission_property(doctype, LEARNER_ROLE, 0, "if_owner", 1)
