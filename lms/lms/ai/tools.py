"""Tools Learning's Flow agents call. Each runs as the session's owner, so each checks who that is:
a learner could start a session with any agent open to them and ask it anything."""

from typing import Annotated, Literal

import frappe
from frappe import _
from frappe.flow.lib.tool import ToolContext, tool
from pydantic import BaseModel, Field

from lms.lms.ai.characters import CastKey
from lms.lms.permissions import require_learning_admin

SEARCH_LIMIT = 6


class OutcomeOption(BaseModel):
	label: str = Field(description="Two to four words naming its angle, such as Focus on what to do first")
	outcome: str = Field(description="What people should be able to do, two to four short sentences")


class Point(BaseModel):
	heading: str
	body: str
	source: str = ""


class Choice(BaseModel):
	text: str
	correct: bool
	explanation: str


class Criterion(BaseModel):
	criterion: str
	good: str = Field(description="What a strong answer shows")


class Question(BaseModel):
	idea: int = Field(description="The Lesson key idea it tests, numbered from 0 in Lesson order")
	question: str
	options: list[str]
	answer_index: int = Field(description="Index of the right option, from 0")
	explanation: str
	source: str = ""


class _ActivityBase(BaseModel):
	title: str
	summary: str = Field(description="One sentence on what this activity covers")
	minutes: int


class LessonActivity(_ActivityBase):
	activity_type: Literal["Lesson"]
	points: list[Point] = Field(description="3 to 5 key ideas")


class ScenarioActivity(_ActivityBase):
	activity_type: Literal["Scenario"]
	situation: str = Field(description="The moment the learner faces, in 1 to 3 sentences")
	choices: list[Choice] = Field(description="3 choices, exactly one correct")


class RolePlayActivity(_ActivityBase):
	activity_type: Literal["Role-play"]
	cast: CastKey = Field(description="The cast member whose personality fits this conversation")
	character_role: str = Field(description="Who they are to the learner, e.g. Customer, Colleague, Manager")
	personality: str = Field(
		description="How they feel and act in this situation, true to their cast personality"
	)
	setting: str
	learner_task: str = Field(description="What the learner must do in the conversation")
	opening_line: str = Field(description="The character's first line")
	exchanges: int = Field(
		4, ge=2, le=8, description="How many times the learner replies. Usually 4; 3 for a simple task"
	)
	rubric: list[Criterion] = Field(description="3 or 4 criteria")
	pass_mark: int = Field(70, description="Usually 70")


class CheckActivity(_ActivityBase):
	activity_type: Literal["Check"]
	questions: list[Question] = Field(
		description="A question bank: 2 or 3 questions for every Lesson key idea, each tagged with its idea"
	)


Activity = Annotated[
	LessonActivity | ScenarioActivity | RolePlayActivity | CheckActivity,
	Field(discriminator="activity_type"),
]


class _MomentBase(BaseModel):
	idea: int = Field(description="The key idea this moment checks, numbered from 0 as in the brief")


class Segment(BaseModel):
	text: str
	is_issue: bool = Field(description="True when this part is what the learner should spot")


class SpotMoment(_MomentBase):
	kind: Literal["spot"]
	prompt: str = Field(
		description="What to look for, e.g. Tap every part of this message that crosses the line"
	)
	segments: list[Segment] = Field(
		description="The message, a scene or a document, split into 4 to 10 tappable parts, 1 to 3 of them issues"
	)


class OrderMoment(_MomentBase):
	kind: Literal["order"]
	prompt: str
	steps: list[str] = Field(
		description=(
			"3 to 6 steps in the order a person really does them, first step first, and only steps "
			"inside the moment the prompt names; they are shuffled for the learner"
		)
	)


class RateMoment(_MomentBase):
	kind: Literal["rate"]
	prompt: str = Field(description="The question, e.g. How serious is this?")
	situation: str
	low_label: str = Field(description="Label for the low end, e.g. Fine")
	high_label: str = Field(description="Label for the high end, e.g. Report it now")
	answer: int = Field(description="Where the material puts it, from 0 to 100")


class BetOption(BaseModel):
	text: str
	correct: bool


class BetMoment(_MomentBase):
	kind: Literal["bet"]
	question: str
	options: list[BetOption] = Field(
		description="3 or 4 options, exactly one correct; the learner also says how sure they are"
	)


class ChooseOption(BaseModel):
	text: str
	correct: bool
	why: str = Field(description="One sentence on why this is or is not the better choice")


class ChooseMoment(_MomentBase):
	kind: Literal["choose"]
	prompt: str
	options: list[ChooseOption] = Field(description="2 or 3 short options, exactly one better")


class BuildSlot(BaseModel):
	label: str = Field(description="What goes here, e.g. Debit, Credit, First step")
	answer: str = Field(description="The piece that belongs in this slot")


class BuildMoment(_MomentBase):
	kind: Literal["build"]
	prompt: str
	slots: list[BuildSlot] = Field(description="2 to 5 slots to fill")
	extra_pieces: list[str] = Field(default_factory=list, description="0 to 3 plausible wrong pieces")


Moment = Annotated[
	SpotMoment | OrderMoment | RateMoment | BetMoment | ChooseMoment | BuildMoment,
	Field(discriminator="kind"),
]


class GoalPlan(BaseModel):
	title: str = Field(description="A short title for the goal, 2 to 5 words")
	outcome: str = Field(description="What people will be able to do, in one sentence")
	acknowledgement_text: str = Field(
		description="A sentence the learner can agree to, based on the material"
	)
	activities: list[Activity]


class CriterionScore(BaseModel):
	criterion: str
	score: int
	evidence: str = Field(
		description="The learner's most telling phrase, at most fifteen words, no quotation marks"
	)


@tool
def search_goal_sources(
	goal: Annotated[str, "The LMS Goal name"],
	query: Annotated[str, "What to look for in the goal's sources"],
	*,
	ctx: ToolContext,
) -> list[dict]:
	"""Search the documents uploaded for a learning goal. Returns matching passages with their source."""
	_require_admin(ctx.user)
	return _search(_goal_knowledge_base(goal), query)


@tool
def save_goal_plan(
	goal: Annotated[str, "The LMS Goal name"],
	plan: GoalPlan,
	*,
	ctx: ToolContext,
) -> str:
	"""Save the drafted activities for a learning goal, replacing any earlier draft."""
	_require_admin(ctx.user)
	from lms.lms.ai.goals import apply_plan

	# A retry resends the whole conversation, which free model tiers cap per minute, so drop
	# an incomplete activity instead of rejecting the plan, unless too little would be left.
	complete = [a for a in plan.activities if not _missing_parts(a)]
	if len(complete) < MIN_ACTIVITIES:
		frappe.throw(
			_("The plan is incomplete. Fill in every part of each activity and save again: {0}").format(
				"; ".join(
					f"{a.title}: {', '.join(_missing_parts(a))}" for a in plan.activities if _missing_parts(a)
				)
			),
			title=_("Incomplete Plan"),
		)
	plan.activities = complete
	apply_plan(goal, plan.model_dump())
	return _("Saved {0} activities.").format(len(complete))


@tool
def save_activity(
	goal: Annotated[str, "The LMS Goal name"],
	index: Annotated[int, "The activity index from the request"],
	activity: Activity,
	*,
	ctx: ToolContext,
) -> str:
	"""Save one reworked activity in place, for a REVISE ONE ACTIVITY request."""
	_require_admin(ctx.user)
	from lms.lms.ai.revise import save

	if _missing_parts(activity):
		frappe.throw(_("The activity is incomplete: {0}").format(", ".join(_missing_parts(activity))))
	save(goal, index, activity.model_dump(), session=ctx.session_id)
	return _("Saved.")


@tool
def save_suggested_outcome(
	goal: Annotated[str, "The LMS Goal name"],
	options: Annotated[list[OutcomeOption], "Three options, each from a different angle"],
	*,
	ctx: ToolContext,
) -> str:
	"""Offer the admin outcome options to pick from; nothing is saved until they choose one."""
	_require_admin(ctx.user)
	from lms.lms.ai.outcome import offer

	offer(goal, ctx.session_id, [option.model_dump() for option in options])
	return _("Suggested.")


@tool
def search_my_goal_sources(
	query: Annotated[str, "What the learner asked about"],
	*,
	ctx: ToolContext,
) -> list[dict]:
	"""Search the material for the skill this learner is working on."""
	goal = frappe.db.get_value(
		"LMS Goal Assignment", {"tutor_session": ctx.session_id, "member": ctx.user}, "goal"
	) or frappe.db.get_value(
		"LMS Goal Evidence", {"flow_session": ctx.session_id, "member": ctx.user}, "goal"
	)
	if not goal:
		frappe.throw(_("This conversation is not linked to a learning goal."), frappe.PermissionError)
	from lms.lms.ai.goals import has_material

	if not has_material(goal):
		return [{"source": "", "content": NO_MATERIAL_HIT}]
	return _search(_goal_knowledge_base(goal), query)


# TUTOR has no brief, so the search itself tells it there is nothing to cite.
NO_MATERIAL_HIT = (
	"This skill has no material, so there is nothing to cite. Answer from widely accepted practice, "
	"say it is general guidance, and send them to their manager for anything specific to their organisation."
)


@tool
def show_moment(moment: Moment, *, ctx: ToolContext) -> str:
	"""Put an interactive exercise in front of the learner instead of asking in plain text: spot the
	issue, put steps in order, rate a situation, answer and bet your confidence, choose between
	options, or build something from pieces. Their answer arrives as their next message.

	Any person in it is Brannoc, Quilla, Fenwick, Odalie or Tavish, never any other name; a role
	with no cast fit stays nameless, such as a contractor or your manager."""
	return _(
		"Shown to the learner. End your turn with one short line inviting them to try it. "
		"Do not repeat what you already said this turn."
	)


@tool
def confirm_idea(
	idea: Annotated[int, "The key idea number from the brief"],
	needed_teaching: Annotated[bool, "True if you had to teach or correct it, false if they already knew it"],
	*,
	ctx: ToolContext,
) -> str:
	"""Tick off a key idea once the learner has shown they understand it, so their checklist updates."""
	from lms.lms.ai.ideas import confirm

	left = confirm(_teaching_assignment(ctx), idea, needed_teaching)
	if left:
		return _("Confirmed. Still to confirm: {0}.").format(", ".join(str(i) for i in left))
	return _("All key ideas confirmed. Call finish_teaching when you are ready.")


@tool
def finish_teaching(
	summary: Annotated[str, "Two sentences: what the learner already knew and what you taught"],
	*,
	ctx: ToolContext,
) -> str:
	"""Mark the teaching done once the learner understands every key idea, so they can practise."""
	from lms.lms.ai.goals import finish_teaching as finish
	from lms.lms.ai.ideas import unconfirmed

	answered = _learner_turns(ctx.session_id)
	if answered < MIN_TEACHING_TURNS:
		return _(
			"Too early: the learner has answered only {0} times. Keep checking and teaching each key idea first."
		).format(answered)
	missing = unconfirmed(_teaching_assignment(ctx))
	if missing:
		return _("Not yet. These key ideas are not confirmed: {0}. Check them first.").format(
			"; ".join(f"{idea['idea']}: {idea['heading']}" for idea in missing)
		)
	finish(ctx.session_id, ctx.user, summary)
	return _("Teaching marked as done. Tell the learner they are ready to practise.")


@tool
def submit_grade(
	evidence: Annotated[str, "The LMS Goal Evidence name from the grading request"],
	score: Annotated[int, "Overall score from 0 to 100"],
	passed: bool,
	criteria: list[CriterionScore],
	feedback: Annotated[str, "Two short sentences to the learner: what went well, then one thing to change"],
	*,
	ctx: ToolContext,
) -> str:
	"""Record the grade for a role-play."""
	if "System Manager" not in frappe.get_roles(ctx.user):
		frappe.throw(_("Only the grading service can record grades."), frappe.PermissionError)
	from lms.lms.ai.goals import record_grade

	record_grade(evidence, score, passed, [c.model_dump() for c in criteria], feedback)
	return _("Grade recorded.")


@tool
def readiness_summary(*, ctx: ToolContext) -> list[dict]:
	"""For every published learning goal: how many people are assigned, in progress, ready and overdue."""
	_require_admin(ctx.user)
	from lms.lms.ai.goals import goal_readiness

	return [
		{
			key: row[key]
			for key in ("goal", "title", "assigned", "in_progress", "ready", "overdue", "due_date")
		}
		for row in goal_readiness()
	]


@tool
def list_assignments(
	goal: Annotated[str | None, "An LMS Goal name or title, to narrow the list"] = None,
	status: Annotated[
		Literal["Assigned", "In Progress", "Ready", "Overdue"] | None, "Filter by status"
	] = None,
	*,
	ctx: ToolContext,
) -> list[dict]:
	"""People assigned to learning goals with their status, due date and mastery score."""
	_require_admin(ctx.user)
	filters = {"is_preview": 0}
	if goal:
		filters["goal"] = frappe.db.get_value("LMS Goal", {"title": goal}, "name") or goal
	if status == "Overdue":
		filters["status"] = ("!=", "Ready")
		filters["due_date"] = ("<", frappe.utils.today())
	elif status:
		filters["status"] = status
	return frappe.get_all(
		"LMS Goal Assignment",
		filters=filters,
		fields=["member_name", "member", "goal_title", "status", "due_date", "score", "ready_on"],
		order_by="goal_title, member_name",
		limit=200,
	)


MIN_ACTIVITIES = 3


def _missing_parts(activity) -> list[str]:
	"""What a schema cannot enforce: a scenario with exactly one right choice."""
	if activity.activity_type == "Scenario" and sum(c.correct for c in activity.choices) != 1:
		return ["exactly one correct choice"]
	return []


def _search(knowledge_base: str | None, query: str) -> list[dict]:
	if not knowledge_base:
		return []
	from frappe.flow.knowledge.retriever import retrieve

	return [
		{"source": hit["source"], "content": hit["content"]}
		for hit in retrieve(query, kbs=[knowledge_base], limit=SEARCH_LIMIT)
	]


def _goal_knowledge_base(goal: str) -> str | None:
	return frappe.db.get_value("LMS Goal", goal, "knowledge_base")


def _require_admin(user: str) -> None:
	require_learning_admin(user)


# Models sometimes declare a lesson done after the first reply; a lesson needs some real back-and-forth.
MIN_TEACHING_TURNS = 3


def _learner_turns(session: str) -> int:
	"""How many times the learner has replied, not counting the brief that opened the session."""
	from frappe.flow.lib.session import sync_with_retry

	sync_with_retry(frappe.get_doc("Flow Session", session))
	return max(frappe.db.count("Flow Session Message", {"parent": session, "role": "user"}) - 1, 0)


def _teaching_assignment(ctx: ToolContext) -> str:
	"""The assignment whose lesson this teaching session belongs to."""
	assignment = frappe.db.get_value(
		"LMS Goal Evidence",
		{"flow_session": ctx.session_id, "member": ctx.user, "activity_type": "Lesson"},
		"assignment",
	)
	if not assignment:
		frappe.throw(_("This conversation is not a lesson."), frappe.PermissionError)
	return assignment
