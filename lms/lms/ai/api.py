"""Endpoints for Learning's AI goals: the Studio and Readiness for admins, the session for learners."""

import json

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import cint, flt

from lms.lms.ai import course_material, goals, ideas, material, outcome, revise, setup, transcripts, tts
from lms.lms.ai.skill_dashboard import SkillDashboard
from lms.lms.permissions import require_learning_admin


def _require_admin() -> None:
	require_learning_admin()


# Setup


@frappe.whitelist()
def ai_status() -> dict:
	"""What is still missing before AI works on this site."""
	_require_admin()
	embedding = frappe.db.get_single_value("Flow Knowledge Settings", "embedding_model")
	chat = None
	try:
		chat = setup.chat_model()
	except frappe.ValidationError:
		frappe.clear_last_message()
	return {"chat_model": chat, "embedding_model": embedding, "ready": bool(chat and embedding)}


# Studio


@frappe.whitelist()
def list_goals() -> list[dict]:
	_require_admin()
	rows = frappe.get_all(
		"LMS Goal",
		fields=[
			"name",
			"title",
			"status",
			"outcome",
			"learner_outcome",
			"due_date",
			"minutes",
			"modified",
			"owner",
		],
		order_by="modified desc",
	)
	readiness = {row["goal"]: row for row in goals.goal_readiness()}
	activities = dict(
		frappe.get_all(
			"LMS Goal Activity",
			filters={"parenttype": "LMS Goal"},
			fields=["parent", {"COUNT": "*", "as": "count"}],
			group_by="parent",
			as_list=True,
		)
	)
	instructors = _instructors({row.owner for row in rows})
	for row in rows:
		row.readiness = readiness.get(row.name)
		row.activities = activities.get(row.name, 0)
		row.instructor = instructors.get(row.owner)
	return rows


@frappe.whitelist()
def learner_skills() -> list[dict]:
	"""The skills a learner can see, for the Skills list: published ones open to everyone, and
	those given to them. A skill for named people stays hidden from everyone else."""
	user = frappe.session.user
	if user == "Guest":
		return []
	mine = _my_assignments(user)
	rows = frappe.get_all(
		"LMS Goal",
		filters={"status": "Published"},
		or_filters={"assign_everyone": 1, "name": ["in", list(mine) or [""]]},
		fields=SKILL_CARD_FIELDS,
		order_by="published_on desc",
	)
	return _skill_cards(rows, mine)


SKILL_CARD_FIELDS = ["name", "title", "outcome", "learner_outcome", "minutes", "owner", "published_on"]


def _skill_cards(rows: list, mine: dict) -> list:
	"""Fill in what a learner's skill card shows: who made it, how many joined, their own progress."""
	instructors = _instructors({row.owner for row in rows})
	enrolled = dict(
		frappe.get_all(
			"LMS Goal Assignment",
			filters={"goal": ["in", [row.name for row in rows] or [""]], "is_preview": 0},
			fields=["goal", {"COUNT": "*", "as": "count"}],
			group_by="goal",
			as_list=True,
		)
	)
	for row in rows:
		assignment = mine.get(row.name)
		row.enrolled_count = enrolled.get(row.name, 0)
		row.instructor = instructors.get(row.pop("owner"))
		row.enrolled = bool(assignment)
		row.state = assignment.status if assignment else None
		row.progress = flt(assignment.progress) if assignment else 0
		row.due_date = assignment.due_date if assignment else None
	return rows


def _my_assignments(user: str) -> dict:
	return {
		row.goal: row
		for row in frappe.get_all(
			"LMS Goal Assignment",
			filters={"member": user, "is_preview": 0},
			fields=["goal", "status", "progress", "due_date"],
		)
	}


@frappe.whitelist()
def course_practice(course: str) -> list[dict]:
	"""Skills that practise a course, offered once the learner finishes it. Only published skills
	open to everyone: a skill for named people follows its own audience."""
	user = frappe.session.user
	if user == "Guest" or not frappe.db.table_exists("LMS Goal Course"):
		return []
	progress = frappe.db.get_value("LMS Enrollment", {"member": user, "course": course}, "progress")
	if flt(progress) < 100:
		return []
	goals_of_course = frappe.get_all(
		"LMS Goal Course", filters={"course": course, "parenttype": "LMS Goal"}, pluck="parent"
	)
	if not goals_of_course:
		return []
	rows = frappe.get_all(
		"LMS Goal",
		filters={"status": "Published", "assign_everyone": 1, "name": ["in", goals_of_course]},
		fields=SKILL_CARD_FIELDS,
		order_by="published_on desc",
	)
	return _skill_cards(rows, _my_assignments(user))


def has_learner_skills(user: str) -> bool:
	"""Whether the Skills list has anything for this user, so the sidebar shows it only then."""
	if frappe.db.exists("LMS Goal Assignment", {"member": user, "is_preview": 0}):
		return True
	return bool(frappe.db.exists("LMS Goal", {"status": "Published", "assign_everyone": 1}))


def _instructors(users: set[str]) -> dict[str, dict]:
	"""The person who made each skill, shown on its card the way a course shows its instructor."""
	return {
		user.name: user
		for user in frappe.get_all(
			"User", filters={"name": ("in", list(users))}, fields=["name", "full_name", "user_image as image"]
		)
	}


@frappe.whitelist(methods=["POST"])
def create_goal(title: str | None = None, outcome: str | None = None, instructions: str | None = None) -> str:
	_require_admin()
	return goals.create_goal(title, outcome, instructions)


@frappe.whitelist()
def get_goal(goal: str) -> dict:
	_require_admin()
	doc = frappe.get_doc("LMS Goal", goal)
	state = goals.drafting_state(goal)
	data = frappe.get_doc("LMS Goal", goal).as_dict()
	data.status, data.draft_error = state.status, state.draft_error
	for row in data.activities:
		row.content = json.loads(row.content or "{}")
	data.sources = material.goal_sources(doc.name)
	data.documents = goals.documents(doc)
	return data


@frappe.whitelist(methods=["POST"])
def add_source(goal: str, file_url: str) -> list[dict]:
	_require_admin()
	material.add_sources(goal, [file_url])
	return material.goal_sources(goal)


@frappe.whitelist(methods=["POST"])
def add_url(goal: str, url: str) -> list[dict]:
	"""Teach the skill from a web page, such as a page of the product docs."""
	_require_admin()
	material.add_url(goal, url)
	return material.goal_sources(goal)


@frappe.whitelist(methods=["POST"])
def add_course(goal: str, course: str) -> list[dict]:
	"""Teach the skill from a course's lessons, published or still a draft."""
	_require_admin()
	course_material.add_course(goal, course)
	return material.goal_sources(goal)


@frappe.whitelist(methods=["POST"])
def reread_course(goal: str, course: str) -> list[dict]:
	"""Read a linked course again, for lessons that failed the first time."""
	_require_admin()
	course_material.enqueue_sync(goal, course)
	return material.goal_sources(goal)


@frappe.whitelist(methods=["POST"])
def suggest_outcome(goal: str) -> str:
	"""Draft what people should be able to do from the goal's material. Returns the session to follow."""
	_require_admin()
	return outcome.suggest(goal)


@frappe.whitelist()
def outcome_state(session: str) -> dict:
	_require_admin()
	return outcome.state(session)


@frappe.whitelist(methods=["POST"])
def remove_source(goal: str, document: str) -> list[dict]:
	_require_admin()
	material.remove_source(goal, document)
	return material.goal_sources(goal)


@frappe.whitelist(methods=["POST"])
def revise_activity(goal: str, index: int, request: str) -> str:
	"""Rework one activity by asking. Returns the session to follow with revision_state."""
	_require_admin()
	return revise.revise(goal, int(index), request)


@frappe.whitelist()
def revision_state(session: str) -> dict:
	_require_admin()
	return revise.state(session)


@frappe.whitelist(methods=["POST"])
def draft_plan(goal: str) -> str:
	_require_admin()
	return goals.draft(goal)


@frappe.whitelist(methods=["POST"])
def save_goal(goal: str, values: dict | str) -> dict:
	"""Save the admin's edits: goal fields, activities, proof and audience."""
	_require_admin()
	values = frappe.parse_json(values)
	doc = frappe.get_doc("LMS Goal", goal)
	if "title" in values:
		values["title"] = (values["title"] or "").strip() or goals.UNTITLED
	for field in (
		"title",
		"outcome",
		"instructions",
		"due_date",
		"recurrence",
		"proof_mastery",
		"mastery_threshold",
		"check_questions",
		"proof_acknowledgement",
		"acknowledgement_text",
		"proof_sign_off",
		"proof_certificate",
		"assign_everyone",
		"tutor_first",
	):
		if field in values:
			doc.set(field, values[field])
	moved = None
	if "activities" in values:
		moved = goals.activity_moves(doc, values["activities"])
		doc.set(
			"activities",
			[
				{
					"name": row.get("name"),
					"activity_type": row["activity_type"],
					"title": row["title"],
					"summary": row.get("summary"),
					"minutes": row.get("minutes"),
					"content": json.dumps(row.get("content") or {}),
				}
				for row in values["activities"]
			],
		)
		doc.minutes = sum(int(row.get("minutes") or 0) for row in values["activities"])
	if "audience" in values:
		doc.set("audience", [{"user": user} for user in values["audience"]])
	doc.save()
	if moved:
		goals.move_evidence(doc.name, moved)
	return get_goal(goal)


@frappe.whitelist(methods=["POST"])
def publish_goal(goal: str) -> int:
	_require_admin()
	return goals.publish(goal)


@frappe.whitelist(methods=["POST"])
def try_as_learner(goal: str) -> str:
	_require_admin()
	return goals.start_preview(goal)


@frappe.whitelist()
def search_people(query: str = "") -> list[dict]:
	_require_admin()
	return frappe.get_all(
		"User",
		filters={"enabled": 1, "name": ("not in", ("Administrator", "Guest"))},
		or_filters={"full_name": ("like", f"%{query}%"), "name": ("like", f"%{query}%")},
		fields=["name", "full_name", "user_image"],
		limit=20,
		order_by="full_name asc",
	)


# Readiness


@frappe.whitelist()
def readiness() -> dict:
	_require_admin()
	return {"goals": goals.goal_readiness(), "people": goals.people()}


@frappe.whitelist()
def skill_dashboard(goal: str) -> dict:
	"""One skill's dashboard: its numbers, where people struggle, and who they are."""
	_require_admin()
	return {
		"summary": goals.skill_summary(goal),
		"people": goals.people(goal),
		"trends": SkillDashboard(goal).data(),
	}


@frappe.whitelist()
def person_evidence(assignment: str) -> dict:
	_require_admin()
	return {
		"assignment": frappe.get_doc("LMS Goal Assignment", assignment).as_dict(),
		"evidence": goals.evidence_for(assignment),
	}


@frappe.whitelist(methods=["POST"])
def sign_off(assignment: str) -> dict:
	_require_admin()
	frappe.db.set_value("LMS Goal Assignment", assignment, "signed_off_by", frappe.session.user)
	return goals.refresh_assignment(assignment)


@frappe.whitelist(methods=["POST"])
def remind(goal: str, members: list[str] | str) -> int:
	_require_admin()
	doc = frappe.get_doc("LMS Goal", goal)
	members = frappe.parse_json(members)
	for member in members:
		goals._notify(doc, member)
	return len(members)


@frappe.whitelist(methods=["POST"])
def readiness_session() -> str:
	"""A conversation with the readiness assistant, for the admin's "ask anything"."""
	_require_admin()
	from frappe.flow.lib.session import new_session

	setup.ensure_agents()
	return new_session(setup.READINESS, title=_("Readiness"), approval_mode="Auto-approve").name


# Learner


@frappe.whitelist()
def skill_overview(goal: str) -> dict:
	"""What a learner sees before starting a skill open to everyone: what it is, its parts and
	who has taken it. Starting it (home.join_skill) is what enrols them."""
	user = frappe.session.user
	skill = frappe.db.get_value(
		"LMS Goal",
		goal,
		["name", "title", "status", "assign_everyone", "outcome", "learner_outcome", "minutes", "owner"],
		as_dict=True,
	)
	enrolled = bool(
		skill and frappe.db.exists("LMS Goal Assignment", {"goal": goal, "member": user, "is_preview": 0})
	)
	if not skill or skill.status != "Published" or not (skill.assign_everyone or enrolled):
		frappe.throw(_("This skill is not open to you."), frappe.PermissionError)
	parts = frappe.get_all(
		"LMS Goal Activity",
		filters={"parent": goal, "parenttype": "LMS Goal"},
		fields=["activity_type", "title", "minutes"],
		order_by="idx asc",
	)
	return {
		"name": skill.name,
		"title": skill.title,
		"outcome": skill.learner_outcome or skill.outcome,
		"minutes": skill.minutes,
		"parts": parts,
		"enrolled": enrolled,
		"enrolled_count": frappe.db.count("LMS Goal Assignment", {"goal": goal, "is_preview": 0}),
		"instructor": _instructors({skill.owner}).get(skill.owner),
	}


@frappe.whitelist()
def my_assignment(goal: str, preview: int = 0) -> str:
	"""The caller's assignment for this goal, so links can carry the goal's slug."""
	name = frappe.db.get_value(
		"LMS Goal Assignment",
		{"goal": goal, "member": frappe.session.user, "is_preview": cint(preview)},
		order_by="creation desc",
	)
	if not name:
		frappe.throw(_("You are not assigned this skill."), frappe.DoesNotExistError)
	return name


@frappe.whitelist()
def session_state(assignment: str) -> dict:
	return goals.learner_state(assignment)


@frappe.whitelist(methods=["POST"])
def submit_activity(assignment: str, index: int, response: dict | str) -> dict:
	return goals.submit_activity(assignment, int(index), frappe.parse_json(response))


@frappe.whitelist(methods=["POST"])
def start_check(assignment: str, index: int, fresh: bool = False) -> list[dict]:
	return goals.start_check(assignment, int(index), bool(frappe.parse_json(fresh)))


@frappe.whitelist(methods=["POST"])
def record_moment(
	assignment: str, idea: int | None = None, correct: bool = False, confidence: str | None = None
) -> None:
	"""Count a moment the learner answered during teaching against its key idea."""
	goals.get_assignment(assignment)
	ideas.record_moment(
		assignment, None if idea in (None, "") else int(idea), bool(frappe.parse_json(correct)), confidence
	)


@frappe.whitelist(methods=["POST"])
def start_roleplay(assignment: str, index: int) -> str:
	return goals.start_roleplay(assignment, int(index))


@frappe.whitelist(methods=["POST"])
def start_teaching(assignment: str, index: int) -> str:
	return goals.start_teaching(assignment, int(index))


@frappe.whitelist()
def source_file(document: str, assignment: str | None = None, goal: str | None = None) -> None:
	"""Open a cited document, for a learner assigned the goal or an admin building it."""
	goal = _cited_goal(assignment, goal)
	file_url = material.source_file_url(goal, document)
	elsewhere = (
		None
		if file_url
		else (material.source_url(goal, document) or course_material.lesson_link(goal, document))
	)
	if elsewhere:
		frappe.local.response.update({"type": "redirect", "location": elsewhere})
		return
	if not file_url:
		frappe.throw(_("This document is no longer available."), frappe.DoesNotExistError)
	file = frappe.get_doc("File", {"file_url": file_url})
	frappe.local.response.update(
		{
			"type": "download",
			"filename": file.file_name,
			"filecontent": file.get_content(),
			"display_content_as": "inline",
		}
	)


@frappe.whitelist()
def source_excerpt(
	document: str,
	page: int | None = None,
	near: str = "",
	assignment: str | None = None,
	goal: str | None = None,
) -> str | None:
	"""The passage a citation points to, shown when someone hovers it."""
	return material.excerpt(_cited_goal(assignment, goal), document, int(page) if page else None, near[:500])


def _cited_goal(assignment: str | None, goal: str | None) -> str:
	"""The goal a citation belongs to, for a learner assigned it or an admin building it."""
	if assignment:
		return goals.get_assignment(assignment).goal
	if not goal:
		frappe.throw(_("Say which goal the document belongs to."), title=_("Missing Goal"))
	_require_admin()
	return goal


@frappe.whitelist(methods=["POST"])
def finish_roleplay(assignment: str, index: int) -> None:
	goals.finish_roleplay(assignment, int(index))


@frappe.whitelist()
def speech_providers() -> list[str]:
	"""The hosted voices this site can speak with; empty means the browser voice."""
	return tts.providers()


@frappe.whitelist()
def transcription_available() -> bool:
	"""Whether this site can write speech down (the local sidecar, or DeepInfra's Whisper); without
	either the browser's own engine does."""
	return bool(transcripts.speech_service())


@frappe.whitelist(methods=["POST"])
@rate_limit(limit=30, seconds=60)
def transcribe(session: str | None = None) -> dict:
	"""The learner's recorded turn as text, from the same Whisper that reads video lessons.

	With the conversation's session, Whisper is primed with the skill's own words.
	"""
	if frappe.session.user == "Guest":
		frappe.throw(_("Sign in to use voice."), frappe.PermissionError)
	upload = frappe.request.files.get("audio")
	if not upload:
		frappe.throw(_("Nothing was recorded."), frappe.ValidationError)
	data = upload.read()
	if len(data) > 10 * 1024 * 1024:
		frappe.throw(_("This recording is too long."), frappe.ValidationError)
	service = transcripts.speech_service()
	if not service:
		frappe.throw(_("No transcription service is configured on this site."), frappe.ValidationError)
	hint = goals.transcription_hint(session, frappe.session.user) if session else ""
	try:
		text = transcripts.transcribe_audio(service, data, hint)
	except Exception as e:
		frappe.log_error("Speech recognition failed", str(e)[:1000])
		frappe.throw(_("We could not transcribe that. Try again."))
	return {"text": text}


@frappe.whitelist(methods=["POST"])
@rate_limit(limit=120, seconds=60)
def speech(text: str, character: str = "lumi", provider: str | None = None) -> None:
	"""One sentence of a reply as audio, in the character's voice."""
	if frappe.session.user == "Guest":
		frappe.throw(_("Sign in to use voice."), frappe.PermissionError)
	audio, mimetype = tts.synthesize(text, character, provider)
	frappe.local.response.update(
		{
			"type": "download",
			"filename": "speech",
			"filecontent": audio,
			"content_type": mimetype,
			"display_content_as": "inline",
		}
	)


@frappe.whitelist(methods=["POST"])
def roleplay_reply(session: str, message: str) -> dict:
	return goals.roleplay_reply(session, message)


@frappe.whitelist(methods=["POST"])
def tutor_session(assignment: str) -> str:
	return goals.tutor_session(assignment)


@frappe.whitelist(methods=["POST"])
def acknowledge(assignment: str) -> dict:
	return goals.acknowledge(assignment)
