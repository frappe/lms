"""Tool catalog and dispatcher used by the AI Gateway.

The Gateway lists tools with :func:`catalog` and calls them with :func:`call`,
always as the real user of the widget. A learner's agent never sees teacher
tools, and every call — allowed, denied or failed — lands in Copilot Tool Log.
"""

import time
from dataclasses import dataclass, field

import frappe
from frappe import _

from lms.copilot import access, conversations, course_import, feedback, insights, read_tools
from lms.copilot.access import ENGINE, LEARNER, REVIEWER, TEACHER
from lms.copilot.audit import log_tool
from lms.copilot.proposals import create_proposal
from lms.copilot.validation import optional_text, parse_object

READ = "read"
PROPOSE = "propose"
RECORD = "record"


def _string(description, **extra):
	return {"type": "string", "description": description, **extra}


def _schema(required, **properties):
	return {
		"type": "object",
		"properties": properties,
		"required": list(required),
		"additionalProperties": False,
	}


CITATION = {
	"type": "object",
	"properties": {
		"file": _string("Repository file path, for code evidence."),
		"line_start": {"type": "integer"},
		"line_end": {"type": "integer"},
		"lesson": _string("Course Lesson name, for lesson evidence."),
		"block_id": _string("EditorJS block id inside the lesson."),
		"label": _string("Short label shown to the teacher."),
	},
}
CONFIDENCE = {"type": "string", "enum": ["High", "Medium", "Low"]}


@dataclass(frozen=True)
class Tool:
	name: str
	kind: str
	audiences: frozenset
	description: str
	parameters: dict
	handler: object = field(repr=False, compare=False)

	@property
	def is_write(self):
		return self.kind != READ


def _proposal(tool_name):
	def handler(conversation=None, insight=None, **params):
		return create_proposal(tool_name, params, conversation=conversation, insight=insight)

	return handler


def _propose_course_draft(**params):
	result = create_proposal("propose_course_draft", params)
	course_import.attach_proposal(params.get("course_import"), result["proposal"])
	return result


SOURCE_REFS = {
	"type": "array",
	"description": "Pages the content comes from, e.g. [{source: 'S1', pages: [3, 4]}].",
	"items": {
		"type": "object",
		"properties": {
			"source": _string("Source id from get_import_sources (S1, S2…)."),
			"pages": {"type": "array", "items": {"type": "integer"}},
		},
		"required": ["source", "pages"],
	},
}

TOOLS = [
	Tool(
		"get_course_outline",
		READ,
		frozenset({TEACHER, LEARNER, ENGINE}),
		"Chapters and lessons of a course with their publication state.",
		_schema(["course"], course=_string("LMS Course name.")),
		read_tools.get_course_outline,
	),
	Tool(
		"get_lesson_content",
		READ,
		frozenset({TEACHER, LEARNER, ENGINE}),
		"Text of a lesson split into citable blocks. Learners only read lessons open to them.",
		_schema(["lesson"], lesson=_string("Course Lesson name.")),
		read_tools.get_lesson_content,
	),
	Tool(
		"search_course_content",
		READ,
		frozenset({TEACHER, LEARNER, ENGINE}),
		"Find lesson passages to cite when answering. Always cite before explaining.",
		_schema(
			["course", "query"],
			course=_string("LMS Course name."),
			query=_string("What to look for."),
			limit={"type": "integer", "minimum": 1, "maximum": read_tools.MAX_SEARCH_RESULTS},
		),
		read_tools.search_course_content,
	),
	Tool(
		"get_assignment_and_rubric",
		READ,
		frozenset({TEACHER, REVIEWER, ENGINE}),
		"Assignment brief and the rubric the teacher grades it with.",
		_schema(["assignment"], assignment=_string("LMS Assignment name.")),
		read_tools.get_assignment_and_rubric,
	),
	Tool(
		"get_submission",
		READ,
		frozenset({TEACHER, REVIEWER, ENGINE}),
		"A project submission: repository, commit, test results, attempt number and completed lessons.",
		_schema(["project_submission"], project_submission=_string("Copilot Project Submission name.")),
		read_tools.get_submission,
	),
	Tool(
		"get_rewrite_context",
		READ,
		frozenset({TEACHER, REVIEWER, ENGINE}),
		"For a rewrite job: the previous feedback draft (scores, reasons, citations, message) and the "
		"teacher's rewrite note and edits. Use it to address exactly what the teacher asked for.",
		_schema(
			["project_submission", "rewrite_of"],
			project_submission=_string("Copilot Project Submission being reviewed."),
			rewrite_of=_string("Copilot Feedback Draft the teacher sent back."),
		),
		read_tools.get_rewrite_context,
	),
	Tool(
		"get_learner_progress",
		READ,
		frozenset({TEACHER}),
		"Progress, quiz scores and submissions of every learner in a course, by pseudonym.",
		_schema(["course"], course=_string("LMS Course name.")),
		read_tools.get_learner_progress,
	),
	Tool(
		"gather_weekly_signals",
		READ,
		frozenset({TEACHER, REVIEWER, ENGINE}),
		"Questions, low rubric scores and inactive learners of one week, for the stuck-point report.",
		_schema(
			["course"],
			course=_string("LMS Course name."),
			week_start=_string("Any date in the week, YYYY-MM-DD."),
		),
		insights.gather_weekly_signals,
	),
	Tool(
		"record_submission_tests",
		RECORD,
		frozenset({ENGINE}),
		"Store sandbox test results for a submission. Learners see results immediately.",
		_schema(
			["project_submission", "results"],
			project_submission=_string("Copilot Project Submission name."),
			results={
				"type": "array",
				"items": {
					"type": "object",
					"properties": {
						"name": {"type": "string"},
						"passed": {"type": "boolean"},
						"message": {"type": "string"},
					},
					"required": ["name", "passed"],
				},
			},
			commit_sha=_string("Commit that was tested."),
			error=_string("Why tests could not run, if they could not."),
		),
		feedback.record_submission_tests,
	),
	Tool(
		"propose_feedback",
		PROPOSE,
		frozenset({TEACHER, REVIEWER, ENGINE}),
		"Draft rubric feedback for a submission. A teacher reviews it before the learner sees anything. "
		"Score every criterion, cite files and lines, suggest direction instead of full solutions.",
		_schema(
			["project_submission", "scores", "message"],
			project_submission=_string("Copilot Project Submission name."),
			scores={
				"type": "array",
				"items": {
					"type": "object",
					"properties": {
						"criterion": {"type": "string"},
						"level": {"type": "integer", "minimum": 1},
						"reason": {"type": "string"},
						"confidence": CONFIDENCE,
						"citations": {"type": "array", "items": CITATION},
					},
					"required": ["criterion", "level", "reason", "confidence"],
				},
			},
			message=_string("Message to the learner, written for their stage of the course."),
			model=_string("Model that drafted this."),
		),
		feedback.propose_feedback,
	),
	Tool(
		"propose_lesson_change",
		PROPOSE,
		frozenset({TEACHER, ENGINE}),
		"Propose adding or replacing Markdown in a lesson. "
		"Nothing changes until a teacher approves the diff.",
		_schema(
			["lesson", "markdown"],
			lesson=_string("Course Lesson name."),
			markdown=_string("Markdown to insert."),
			mode={"type": "string", "enum": ["append", "replace_block"]},
			after_block=_string("Insert after this block id when appending."),
			block_id=_string("Block to replace when mode is replace_block."),
			reason=_string("Why this change helps learners."),
			confidence=CONFIDENCE,
			insight=_string("Copilot Weekly Insight that motivated the change."),
		),
		_proposal("propose_lesson_change"),
	),
	Tool(
		"propose_lesson_quiz",
		PROPOSE,
		frozenset({TEACHER, ENGINE}),
		"Propose a quiz appended to a lesson. Nothing is created until a teacher approves it.",
		_schema(
			["lesson", "quiz"],
			lesson=_string("Course Lesson name."),
			quiz={
				"type": "object",
				"description": "title, passing_percentage, questions[{text, "
				"type: Choices|User Input|Open Ended, marks, "
				"options[{text, is_correct, explanation}] or answers[]}]",
			},
			confidence=CONFIDENCE,
			insight=_string("Copilot Weekly Insight that motivated the quiz."),
		),
		_proposal("propose_lesson_quiz"),
	),
	Tool(
		"propose_learner_reminder",
		PROPOSE,
		frozenset({TEACHER, ENGINE}),
		"Propose a reminder to learners who are behind. They are addressed by pseudonym.",
		_schema(
			["course", "learners", "message"],
			course=_string("LMS Course name."),
			learners={
				"type": "array",
				"items": {"type": "string"},
				"description": "Learner pseudonyms (L-…).",
			},
			message=_string("The reminder text."),
			reason=_string("Why these learners."),
			confidence=CONFIDENCE,
			insight=_string("Copilot Weekly Insight that motivated the reminder."),
		),
		_proposal("propose_learner_reminder"),
	),
	Tool(
		"propose_rubric",
		PROPOSE,
		frozenset({TEACHER, ENGINE}),
		"Propose the grading rubric of an assignment. Replaces the current rubric once a teacher approves; "
		"nothing is created or changed before that.",
		_schema(
			["assignment", "criteria"],
			assignment=_string("LMS Assignment name."),
			criteria={
				"type": "array",
				"minItems": 1,
				"items": {
					"type": "object",
					"properties": {
						"criterion": _string("Short criterion name, unique in the rubric."),
						"description": _string("What the criterion checks."),
						"max_level": {"type": "integer", "minimum": 1, "maximum": 10},
						"points": {"type": "number", "minimum": 0},
						"levels": _string("What each level means, one line per level: '1: …'."),
						"taught_in_lesson": _string("Course Lesson where the skill is taught."),
						"pass_example": _string("Example that meets the criterion. Hidden from learners."),
						"fail_example": _string("Example that misses it. Hidden from learners."),
					},
					"required": ["criterion"],
				},
			},
			title=_string("Rubric title. Defaults to the assignment title."),
			visible_to_learner={"type": "boolean"},
			notes=_string("Notes for the review agent."),
			reason=_string("Why this rubric, for the teacher."),
			confidence=CONFIDENCE,
		),
		_proposal("propose_rubric"),
	),
	Tool(
		"get_import_sources",
		READ,
		frozenset({TEACHER, ENGINE}),
		"Text extracted from the documents a teacher uploaded for a new course, page by page, "
		"with source ids (S1, S2…) to cite.",
		_schema(["course_import"], course_import=_string("Copilot Course Import name.")),
		course_import.get_import_sources,
	),
	Tool(
		"record_import_error",
		RECORD,
		frozenset({ENGINE}),
		"Tell the teacher why a course could not be drafted from their documents.",
		_schema(
			["course_import", "error"],
			course_import=_string("Copilot Course Import name."),
			error=_string("What went wrong, for the teacher."),
		),
		course_import.record_import_error,
	),
	Tool(
		"propose_course_draft",
		PROPOSE,
		frozenset({TEACHER, ENGINE}),
		"Propose a complete course built from the teacher's documents: chapters, lessons in Markdown, "
		"assignments and their rubrics. Every lesson cites the pages it comes from; lessons without a "
		"source are flagged. Nothing is created until a teacher approves.",
		_schema(
			["course_import", "short_introduction", "chapters"],
			course_import=_string("Copilot Course Import name."),
			title=_string("Course title. Defaults to the title the teacher gave."),
			short_introduction=_string("One or two sentences for the course card."),
			description=_string("Markdown course description: audience, outcomes, prerequisites."),
			chapters={
				"type": "array",
				"minItems": 1,
				"items": {
					"type": "object",
					"properties": {
						"title": {"type": "string"},
						"lessons": {
							"type": "array",
							"minItems": 1,
							"items": {
								"type": "object",
								"properties": {
									"title": {"type": "string"},
									"markdown": _string("Lesson content in Markdown."),
									"sources": SOURCE_REFS,
								},
								"required": ["title", "markdown", "sources"],
							},
						},
					},
					"required": ["title", "lessons"],
				},
			},
			assignments={
				"type": "array",
				"items": {
					"type": "object",
					"properties": {
						"title": {"type": "string"},
						"question": _string("Assignment brief in Markdown."),
						"after_lesson": _string("Outline number of the lesson it follows, e.g. 2.1."),
						"sources": SOURCE_REFS,
						"rubric": {
							"type": "object",
							"properties": {
								"title": {"type": "string"},
								"notes": {"type": "string"},
								"criteria": {
									"type": "array",
									"minItems": 1,
									"items": {
										"type": "object",
										"properties": {
											"criterion": {"type": "string"},
											"description": {"type": "string"},
											"max_level": {"type": "integer", "minimum": 1, "maximum": 10},
											"points": {"type": "number", "minimum": 0},
											"levels": {"type": "string"},
											"taught_in_lesson": _string("Outline number, e.g. 1.2."),
										},
										"required": ["criterion"],
									},
								},
							},
							"required": ["criteria"],
						},
					},
					"required": ["title", "question", "after_lesson", "rubric"],
				},
			},
			reason=_string("Anything the teacher should know about the draft."),
			confidence=CONFIDENCE,
		),
		_propose_course_draft,
	),
	Tool(
		"save_weekly_insight",
		RECORD,
		frozenset({TEACHER, REVIEWER, ENGINE}),
		"Store the grouped stuck points of a week with evidence and linked proposals.",
		_schema(
			["course", "groups"],
			course=_string("LMS Course name."),
			week_start=_string("Any date in the week, YYYY-MM-DD."),
			groups={"type": "array", "items": {"type": "object"}},
			at_risk={"type": "array", "items": {"type": "object"}},
			stats={"type": "object"},
			model=_string("Model that wrote the report."),
		),
		insights.save_weekly_insight,
	),
	Tool(
		"log_conversation_turn",
		RECORD,
		frozenset({LEARNER}),
		"Save a learner question and the assistant answer so the learner can rate it.",
		_schema(
			["course", "question", "answer"],
			course=_string("LMS Course name."),
			lesson=_string("Course Lesson name."),
			question=_string("The learner's question."),
			answer=_string("The assistant's answer."),
			citations={"type": "array", "items": CITATION},
			model=_string("Model that answered."),
		),
		conversations.log_conversation_turn,
	),
	Tool(
		"escalate_to_teacher",
		PROPOSE,
		frozenset({LEARNER}),
		"Hand the question to the teacher when the course has no grounds for an answer or it is about fees, "
		"schedule, deadlines or complaints.",
		_schema(
			["course", "question"],
			course=_string("LMS Course name."),
			lesson=_string("Course Lesson name."),
			question=_string("The learner's question, verbatim."),
			summary=_string("Context for the teacher."),
		),
		conversations.escalate,
	),
]
TOOLS_BY_NAME = {tool.name: tool for tool in TOOLS}
# Tools that attach their output to the widget conversation they came from.
CONVERSATION_TOOLS = {
	"log_conversation_turn",
	"escalate_to_teacher",
	"propose_lesson_change",
	"propose_lesson_quiz",
	"propose_learner_reminder",
	"propose_rubric",
}


def catalog(user=None):
	"""Tools the user may call, in the function-calling shape LLM APIs expect."""
	user_audiences = access.audiences(user)
	return [
		{
			"name": tool.name,
			"kind": tool.kind,
			"writes": tool.is_write,
			"description": tool.description,
			"parameters": tool.parameters,
		}
		for tool in TOOLS
		if tool.audiences & user_audiences
	]


def call(tool, arguments=None, conversation=None, model=None, tokens_in=None, tokens_out=None):
	started = time.monotonic()
	user_audiences = access.audiences()
	definition = TOOLS_BY_NAME.get(tool)
	arguments = parse_object(arguments or {}, _("Arguments"))
	conversation = optional_text(conversation, _("Conversation"), 140)
	log = {
		"audience": user_audiences,
		"arguments": arguments,
		"model": model,
		"tokens_in": tokens_in,
		"tokens_out": tokens_out,
		"conversation": conversation,
		"is_write": bool(definition and definition.is_write),
	}

	if not definition or not definition.audiences & user_audiences:
		log_tool(tool or "?", "Denied", error="Tool not available to this user", durable=True, **log)
		frappe.throw(_("The tool {0} is not available to you.").format(tool), frappe.PermissionError)

	allowed = set(definition.parameters["properties"])
	unknown = set(arguments) - allowed
	if unknown:
		log_tool(tool, "Error", error=f"Unknown arguments: {sorted(unknown)}", durable=True, **log)
		frappe.throw(_("Unknown arguments: {0}.").format(", ".join(sorted(unknown))), frappe.ValidationError)

	kwargs = dict(arguments)
	if conversation and tool in CONVERSATION_TOOLS:
		kwargs["conversation"] = conversation

	try:
		result = definition.handler(**kwargs)
	except Exception as error:
		elapsed = (time.monotonic() - started) * 1000
		status = "Denied" if isinstance(error, frappe.PermissionError) else "Error"
		log_tool(tool, status, error=error, duration_ms=elapsed, durable=True, **log)
		raise

	log_tool(
		tool,
		"Success",
		result=result,
		duration_ms=(time.monotonic() - started) * 1000,
		proposal=result.get("proposal") if isinstance(result, dict) else None,
		**log,
	)
	return result
