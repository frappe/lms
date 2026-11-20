import json
import re

"""Tools Learning's Flow agents call. Each runs as the session's owner, so each checks who that is:
a learner could start a session with any agent open to them and ask it anything."""

from typing import Annotated, Literal

import frappe
from frappe import _
from frappe.flow.lib.tool import ToolContext, tool
from pydantic import BaseModel, Field, model_validator

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
	points: list[Point] = Field(description="Exactly as many key ideas as the request asks for")


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


class SortItem(BaseModel):
	text: str
	bucket: int = Field(description="The bucket this item belongs in, numbered from 0")


class SortMoment(_MomentBase):
	kind: Literal["sort"]
	prompt: str
	buckets: list[str] = Field(description="2 or 3 short bucket names")
	items: list[SortItem] = Field(description="4 to 8 short items, each in exactly one bucket")

	@model_validator(mode="after")
	def _buckets_exist(self):
		for item in self.items:
			if not 0 <= item.bucket < len(self.buckets):
				raise ValueError(f"bucket {item.bucket} does not exist; buckets are numbered from 0")
		return self


class MatchPair(BaseModel):
	left: str
	right: str


class MatchMoment(_MomentBase):
	kind: Literal["match"]
	prompt: str
	pairs: list[MatchPair] = Field(description="3 to 5 pairs; the right sides are shuffled for the learner")


class FillMoment(_MomentBase):
	kind: Literal["fill"]
	prompt: str = Field(description="One line of context, e.g. Complete the rule")
	text: str = Field(description="The sentence with each blank written as ___, 1 to 3 blanks")
	answers: list[str] = Field(description="The piece for each blank, in order")
	extra_pieces: list[str] = Field(default_factory=list, description="1 to 3 plausible wrong pieces")

	@model_validator(mode="after")
	def _one_answer_per_blank(self):
		blanks = len(re.findall(r"_{3,}", self.text))
		if not blanks or blanks != len(self.answers):
			raise ValueError(f"text has {blanks} blanks written as ___ but {len(self.answers)} answers")
		return self


class ReplyMoment(_MomentBase):
	kind: Literal["reply"]
	prompt: str = Field(
		description="What they must do, e.g. Quilla asks you this in the corridor. What do you say?"
	)
	message: str = Field(description="The cast member's words, or the situation, as the learner hears it")
	cast: CastKey | None = Field(None, description="The cast member speaking, when one is")
	criteria: list[str] = Field(description="2 or 3 things a good answer does, each a short phrase")


Moment = Annotated[
	SpotMoment
	| OrderMoment
	| RateMoment
	| BetMoment
	| ChooseMoment
	| BuildMoment
	| SortMoment
	| MatchMoment
	| FillMoment
	| ReplyMoment,
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


# QUERIES has no brief, so the search itself tells it there is nothing to cite.
NO_MATERIAL_HIT = (
	"This skill has no material, so there is nothing to cite. Answer from widely accepted practice, "
	"say it is general guidance, and send them to their manager for anything specific to their organisation."
)


@tool
def show_moment(moment: Moment, *, ctx: ToolContext) -> str:
	"""Put an interactive exercise in front of the learner instead of asking in plain text: spot the
	issue, put steps in order, rate a situation, answer and bet your confidence, choose between
	options, build something from pieces, sort items into buckets, match pairs, fill the blanks,
	or reply in their own words. Their answer arrives as their next message.

	Any person in it is Brannoc, Quilla, Fenwick, Odalie or Tavish, never any other name; a role
	with no cast fit stays nameless, such as a contractor or your manager."""
	if not _exercises_agreed(ctx.session_id):
		# The page leaves a moment off screen when its result starts with NOT_SHOWN.
		return NOT_SHOWN + _(
			"You have not asked whether they are ready. Your reply already reacted to their answer, "
			"so do not praise or sum it up again: just ask in one short line whether they are ready "
			"to try a few quick exercises, and end your turn. Call begin_exercises when they say "
			"yes, then show the moment."
		)
	if _answer_stands_out(moment):
		return NOT_SHOWN + _(
			"The right option is much longer than the others, which gives the answer away. Make "
			"every option about the same length, by shortening the right one or adding a real "
			"detail to the others, then call show_moment again straight away. Write no text before "
			"it: the learner has already heard your line."
		)
	if not _claim_turn_moment(ctx.session_id):
		# A second exercise in one turn would replace the first on screen before it is answered.
		return NOT_SHOWN + _(
			"An exercise is already on screen this turn. Write nothing more and wait for their answer."
		)
	return _("Shown to the learner. Your turn is over: write nothing more.")


def _turn_moment_key(session: str) -> str:
	return f"lms:turn-moment:{session}"


def _claim_turn_moment(session: str) -> bool:
	"""Whether this is the turn's first exercise. The learner's next message frees the turn."""
	# Set-if-absent in one step: a model can send two show_moment calls in one response.
	key = frappe.cache.make_key(_turn_moment_key(session))
	# nosemgrep: frappe-cache-breaks-multitenancy - make_key prefixes the site's db_name; set_value has no nx
	return bool(frappe.cache.set(key, 1, nx=True, ex=AGREED_TTL))


def free_turn_moment(session: str) -> None:
	frappe.cache.delete(frappe.cache.make_key(_turn_moment_key(session)))


# The right option may run this much longer than the longest wrong one before it gives itself away.
LENGTH_TELL = 1.25


def _answer_stands_out(moment) -> bool:
	moment = moment.model_dump() if isinstance(moment, BaseModel) else moment
	if moment.get("kind") not in ("choose", "bet"):
		return False
	options = [option for option in moment.get("options") or [] if isinstance(option, dict)]
	right = [len(option.get("text") or "") for option in options if option.get("correct")]
	wrong = [len(option.get("text") or "") for option in options if not option.get("correct")]
	return bool(right and wrong) and right[0] > LENGTH_TELL * max(wrong) and right[0] - max(wrong) > 12


@tool
def begin_exercises(*, ctx: ToolContext) -> str:
	"""Record that the learner said yes to trying exercises, after you asked them. Call it once,
	right after their yes and before the first show_moment; never before you have asked."""
	frappe.cache.set_value(_agreed_key(ctx.session_id), 1, expires_in_sec=AGREED_TTL)
	return _("Noted. Show the first moment now.")


@tool
def remember_situation(
	situation: Annotated[str, "The learner's own situation, in one plain sentence, with no real names"],
	*,
	ctx: ToolContext,
) -> str:
	"""Quietly keep a situation from the learner's own work, so this lesson and the next ones can
	build exercises on it instead of on a cast story. The learner never hears about it: no "I'll
	note that", no "I've saved". Call it alongside your reply and carry on talking."""
	from lms.lms.ai import situations

	kept = situations.remember(_teaching_assignment(ctx), situation)
	# The reply may or may not have asked yet; telling the model it had made it start the
	# reply again in a second message, saying the same thing twice.
	return _(
		"Kept silently. Do not mention keeping it; just use it. If your reply already asked its "
		"question, end your turn now and write nothing more. If not, ask it next, carrying on "
		"from your last sentence: never repeat or rephrase what you already said. Their "
		"situations so far: {0}"
	).format(" | ".join(kept))


@tool
def judge_reply(
	idea: Annotated[int, "The key idea the reply moment checked"],
	met: Annotated[bool, "True when their words met the criteria in substance"],
	*,
	ctx: ToolContext,
) -> str:
	"""Record your judgement of a reply moment, so a weak reply counts against its idea the way a
	missed tap does and the final check comes back to it."""
	from lms.lms.ai.ideas import record_moment

	record_moment(_teaching_assignment(ctx), idea, met, None)
	return _("Recorded.")


@tool
def cover_point(
	point: Annotated[int, "The number of the point in what_counts that the learner's reply covered"],
	*,
	ctx: ToolContext,
) -> str:
	"""In a role-play: record that the learner's last reply covered one point of what_counts,
	specifically and soundly, so their page shows it. Call it silently, alongside your reply."""
	from lms.lms.ai.goals import cover_point as record

	content = _roleplay_content(ctx)
	if not 0 <= point < len(content.get("rubric") or []):
		return _("There is no point {0}. Use a number from what_counts.").format(point)
	from lms.lms.ai.goals import ALL_COVERED_NOTE

	covered = record(ctx.session_id, ctx.user, point)
	open_points = [i for i in range(len(content.get("rubric") or [])) if i not in covered]
	if not open_points:
		return _("Noted. {0} Never mention points or that you noted anything.").format(ALL_COVERED_NOTE)
	return _(
		"Noted. Still open: {0}. Stay in character, steer your next question to one of them, and "
		"never mention points or that you noted anything."
	).format(", ".join(str(i) for i in open_points))


def _roleplay_content(ctx: ToolContext) -> dict:
	"""The role-play this session belongs to, for its learner only."""
	row = frappe.db.get_value(
		"LMS Goal Evidence",
		{"flow_session": ctx.session_id, "member": ctx.user, "activity_type": "Role-play"},
		["goal", "activity_index"],
		as_dict=True,
	)
	if not row:
		frappe.throw(_("This conversation is not a role-play."), frappe.PermissionError)
	activities = frappe.get_doc("LMS Goal", row.goal).activities or []
	if not 0 <= (row.activity_index or 0) < len(activities):
		return {}
	return json.loads(activities[row.activity_index].content or "{}")


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
	# The checklist on the page ticks itself; saying "I'll tick that off" only interrupts.
	if left:
		return _("Confirmed. Never mention ticking, marking or confirming it. Still to confirm: {0}.").format(
			", ".join(str(i) for i in left)
		)
	return _(
		"All key ideas confirmed. Never mention ticking or marking them. Call finish_teaching when "
		"you are ready."
	)


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
	# The page shows its own "You're ready to practise" card under the last reply.
	return _(
		"Teaching marked as done. The page now shows them a card that says they are ready to "
		"practise, so do not say it. Your reply already closed the lesson: write nothing more."
	)


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

# A show_moment refused for want of the learner's yes; kept in step with useFlowChat.ts.
NOT_SHOWN = "NOT_SHOWN "
AGREED_TTL = 7 * 24 * 60 * 60


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


def _agreed_key(session: str) -> str:
	return f"lms:exercises-agreed:{session}"


def _exercises_agreed(session: str) -> bool:
	"""The learner said yes to exercises in this lesson. A lesson that already showed one, from
	before this was asked, counts as agreed."""
	if frappe.cache.get_value(_agreed_key(session)):
		return True
	shown = [
		call.get("id")
		for row in frappe.get_all(
			"Flow Session Message",
			filters={"parent": session, "role": "assistant", "tool_calls": ("like", "%show_moment%")},
			pluck="tool_calls",
		)
		for call in json.loads(row or "[]")
		if "show_moment" in (call.get("name") or call.get("function", {}).get("name") or "")
	]
	if not shown:
		return False
	results = frappe.get_all(
		"Flow Session Message",
		filters={"parent": session, "role": "tool", "tool_call_id": ("in", shown)},
		pluck="content",
	)
	return any(not (content or "").startswith(NOT_SHOWN) for content in results)
