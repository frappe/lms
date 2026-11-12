"""Learning goals: drafting them with AI, publishing them to people, and judging when someone is ready."""

import json

import frappe
from frappe import _
from frappe.utils import cint, flt, getdate, now_datetime, today

from lms.lms.ai import characters, ideas, material, setup

PRACTICE_TYPES = ("Scenario", "Check", "Role-play")


# Drafting


UNTITLED = "Untitled skill"


def create_goal(title: str | None, outcome: str | None = None, instructions: str | None = None) -> str:
	from frappe.flow.knowledge.knowledge import Knowledge

	goal = frappe.get_doc(
		{"doctype": "LMS Goal", "title": title or UNTITLED, "outcome": outcome, "instructions": instructions}
	).insert()
	goal.db_set("knowledge_base", Knowledge(f"Goal {goal.name}").name)
	return goal.name


def draft(goal_name: str) -> str:
	"""Ask the plan drafter for this goal's activities. Returns the Flow Session it works in."""
	from frappe.flow.lib.session import new_session

	goal = frappe.get_doc("LMS Goal", goal_name)
	if material.is_reading(goal.name):
		frappe.throw(
			_("Still reading your material. Build the plan once it's done."), title=_("Still Reading")
		)
	sources = _material_for(goal)
	if not sources and not (goal.outcome or "").strip():
		frappe.throw(
			_("Say what people should be able to do, or add your material, then build the plan."),
			title=_("Nothing to Build From"),
		)
	setup.ensure_agents()
	session = new_session(setup.PLAN_DRAFTER, title=goal.title, approval_mode="Auto-approve")
	goal.db_set({"status": "Drafting", "drafting_session": session.name, "draft_error": None})
	session.chat(
		"\n".join(
			[
				f"Goal: {goal.name}",
				f"Title: {goal.title if goal.title != UNTITLED else 'Not set; give it a short title.'}",
				f"The admin's request, in their words: {goal.outcome or 'Not given; infer it from the material.'}",
				f"Admin notes: {goal.instructions or 'None'}",
				"Plan for: the people who will take this, practising the situations they will face.",
				f"Starts with the Lumi tutor: {'Yes' if goal.tutor_first else 'No'}",
				"",
				*material_lines(sources),
			]
		)
	)
	return session.name


# PLAN_DRAFTER looks for "Material: None" and builds from the outcome alone.
NO_MATERIAL = "None. Build from the admin's request alone."


def material_lines(sources: str) -> list[str]:
	return ["Material:", sources] if sources else [f"Material: {NO_MATERIAL}"]


def has_material(goal_name: str) -> bool:
	knowledge_base = frappe.db.get_value("LMS Goal", goal_name, "knowledge_base")
	return bool(
		knowledge_base
		and frappe.db.exists(
			"Flow Knowledge Source", {"knowledge_base": knowledge_base, "status": "Completed"}
		)
	)


# Each search round resends the whole conversation, which free model tiers cap per minute, so
# the drafter gets the material up front.
MATERIAL_LIMIT = 9000


def _material_for(goal) -> str:
	"""A fair share of every source, in reading order, so long material is covered end to end."""
	sources = frappe.get_all(
		"Flow Knowledge Source",
		filters={"knowledge_base": goal.knowledge_base, "status": "Completed"},
		fields=["name", "title"],
		order_by="creation asc",
	)
	if not sources:
		return ""
	share = MATERIAL_LIMIT // len(sources)
	parts = []
	for source in sources:
		text = " ".join(
			frappe.get_all(
				"Flow Knowledge Chunk",
				filters={"source": source.name},
				pluck="content",
				order_by="chunk_index asc",
			)
		)
		parts.append(f"[{source.title}]\n{' '.join(text.split())[:share]}")
	return "\n\n".join(parts)


def apply_plan(goal_name: str, plan: dict) -> None:
	goal = frappe.get_doc("LMS Goal", goal_name)
	if goal.title == UNTITLED and plan.get("title"):
		goal.title = plan["title"]
	goal.learner_outcome = plan["outcome"]
	goal.acknowledgement_text = goal.acknowledgement_text or plan["acknowledgement_text"]
	goal.set("activities", [])
	for activity in plan["activities"]:
		content = {
			key: value
			for key, value in activity.items()
			if key not in ("activity_type", "title", "summary", "minutes") and value is not None
		}
		if content.get("cast") in characters.CAST:
			content["character"] = characters.CAST[content["cast"]]["name"]
		goal.append(
			"activities",
			{
				"activity_type": activity["activity_type"],
				"title": activity["title"],
				"summary": activity["summary"],
				"minutes": activity["minutes"],
				"content": json.dumps(content),
			},
		)
	goal.minutes = sum(cint(a["minutes"]) for a in plan["activities"])
	goal.status = "Ready"
	goal.draft_error = None
	# nosemgrep: lms-unjustified-ignore-permissions - the plan comes back from the Flow worker, which has no admin session; the admin asked for it
	goal.save(ignore_permissions=True)
	frappe.publish_realtime("lms_goal_drafted", {"goal": goal.name}, user=goal.owner)


def drafting_state(goal_name: str) -> dict:
	"""Whether the drafter is still working, and its error if it stopped without saving a plan."""
	from frappe.flow.lib.session import sync_with_retry

	goal = frappe.db.get_value(
		"LMS Goal", goal_name, ["status", "drafting_session", "draft_error"], as_dict=True
	)
	if goal.status == "Drafting" and goal.drafting_session:
		sync_with_retry(frappe.get_doc("Flow Session", goal.drafting_session))
		goal.status = frappe.db.get_value("LMS Goal", goal_name, "status")
	if goal.status == "Drafting" and goal.drafting_session:
		run = frappe.db.get_value(
			"Flow Run",
			{"session": goal.drafting_session},
			["status", "error"],
			as_dict=True,
			order_by="creation desc",
		)
		if run and run.status in ("Completed", "Failed", "Denied"):
			error = friendly_error(run.error) or _("The plan did not come through. Press Build again.")
			frappe.db.set_value("LMS Goal", goal_name, {"status": "Draft", "draft_error": error})
			goal.status, goal.draft_error = "Draft", error
	return goal


def friendly_error(error: str | None) -> str | None:
	"""Model provider errors are long and technical; the ones people hit get a plain sentence."""
	if not error:
		return None
	text = error.lower()
	if "rate limit" in text or "429" in text:
		return _(
			"The AI is busy right now, because the free plan allows only so much each minute. Wait a minute, then try again."
		)
	if "401" in text or "api key" in text or "authentication" in text:
		return _("The AI provider rejected the key. Check the key in Flow Provider, then try again.")
	return _("The AI could not finish this time. Try again in a moment.")


# Publishing


def publish(goal_name: str) -> int:
	"""Publish a skill and send it to the people it is for. Returns how many newly got it; a skill
	published for no one in particular (an open course) is still published."""
	goal = frappe.get_doc("LMS Goal", goal_name)
	if not goal.activities:
		frappe.throw(_("Build the plan before you publish it."), title=_("No Plan Yet"))
	members = _audience(goal)
	created = 0
	for member in members:
		if frappe.db.exists("LMS Goal Assignment", {"goal": goal.name, "member": member, "is_preview": 0}):
			continue
		# nosemgrep: lms-unjustified-ignore-permissions - publishing gives members an assignment they could not create for themselves
		frappe.get_doc(
			{
				"doctype": "LMS Goal Assignment",
				"goal": goal.name,
				"member": member,
				"due_date": goal.due_date,
			}
		).insert(ignore_permissions=True)
		_notify(goal, member)
		created += 1
	goal.db_set({"status": "Published", "published_on": goal.published_on or now_datetime()})
	return created


def _audience(goal) -> list[str]:
	if goal.assign_everyone:
		return frappe.get_all(
			"User",
			filters={"enabled": 1, "name": ("not in", ("Administrator", "Guest"))},
			pluck="name",
		)
	return [row.user for row in goal.audience]


def _notify(goal, member: str) -> None:
	url = frappe.utils.get_url(f"/lms/my-learning/{goal.name}")
	due = (" " + _("Finish it by {0}.").format(frappe.format(goal.due_date, "Date"))) if goal.due_date else ""
	subject = _("Ready for you: {0}").format(goal.title)
	# nosemgrep: lms-unjustified-ignore-permissions - a notification for another user is always written by the system
	frappe.get_doc(
		{
			"doctype": "Notification Log",
			"for_user": member,
			"type": "Alert",
			"subject": subject,
			"email_content": _(
				"{0} takes about {1} minutes, and you can stop and pick up any time.{2}"
			).format(goal.title, goal.minutes or 10, due),
			"document_type": "LMS Goal",
			"document_name": goal.name,
			"link": f"/lms/my-learning/{goal.name}",
		}
	).insert(ignore_permissions=True)
	if not frappe.db.exists("Email Account", {"default_outgoing": 1, "enable_outgoing": 1}):
		return
	frappe.sendmail(
		recipients=[member],
		subject=subject,
		message=_(
			"<p><b>{0}</b> is ready for you. It takes about {1} minutes, and you can stop and pick up any time.{2}</p><p><a href='{3}'>Start now</a></p>"
		).format(goal.title, goal.minutes or 10, due, url),
		now=False,
	)


def start_preview(goal_name: str) -> str:
	"""A fresh assignment for the admin to try the goal as a learner, kept out of readiness."""
	user = frappe.session.user
	for name in frappe.get_all(
		"LMS Goal Assignment", filters={"goal": goal_name, "member": user, "is_preview": 1}, pluck="name"
	):
		frappe.db.delete("LMS Goal Evidence", {"assignment": name})
		# nosemgrep: lms-unjustified-ignore-permissions - previews are system records of the admin's own try-out
		frappe.delete_doc("LMS Goal Assignment", name, ignore_permissions=True)
	return (
		# nosemgrep: lms-unjustified-ignore-permissions - previews are system records of the admin's own try-out
		frappe.get_doc({"doctype": "LMS Goal Assignment", "goal": goal_name, "member": user, "is_preview": 1})
		.insert(ignore_permissions=True)
		.name
	)


# The learner's session


def documents(goal) -> list[str]:
	"""The names citations can point at: uploaded files, web pages, then linked courses."""
	return (
		list(json.loads(goal.source_files or "{}"))
		+ list(json.loads(goal.source_urls or "{}"))
		+ [row.document for row in goal.courses]
	)


def learner_state(assignment_name: str) -> dict:
	assignment = get_assignment(assignment_name)
	goal = frappe.get_doc("LMS Goal", assignment.goal)
	evidence = _evidence_by_index(assignment.name)
	return {
		"assignment": assignment.as_dict(),
		"goal": {
			"name": goal.name,
			"title": goal.title,
			"outcome": goal.learner_outcome,
			"minutes": goal.minutes,
			"tutor_first": goal.tutor_first,
			"documents": documents(goal),
			"due_date": goal.due_date,
			"proof_mastery": goal.proof_mastery,
			"mastery_threshold": goal.mastery_threshold,
			"proof_acknowledgement": goal.proof_acknowledgement,
			"acknowledgement_text": goal.acknowledgement_text,
			"proof_sign_off": goal.proof_sign_off,
			"proof_certificate": goal.proof_certificate,
		},
		"activities": [
			_learner_view(index, row, evidence.get(index)) for index, row in enumerate(goal.activities)
		],
		"ideas": ideas.learner_ideas(assignment, goal),
	}


def submit_activity(assignment_name: str, index: int, response: dict) -> dict:
	assignment = get_assignment(assignment_name)
	activity, content = _activity(assignment.goal, index)
	if activity.activity_type == "Lesson":
		result = {"score": None, "passed": 1}
	elif activity.activity_type == "Scenario":
		choice = cint(response.get("choice"))
		choices = content.get("choices") or []
		if not 0 <= choice < len(choices):
			frappe.throw(_("Pick one of the choices."), title=_("Invalid Answer"))
		correct = bool(choices[choice].get("correct"))
		result = {
			"score": 100 if correct else 0,
			"passed": int(correct),
			"feedback": choices[choice].get("explanation"),
			"correct_choice": next((i for i, c in enumerate(choices) if c.get("correct")), None),
		}
	elif activity.activity_type == "Check":
		bank = content.get("questions") or []
		selected = ideas.check_questions(assignment, index, bank)
		answers = response.get("answers") or []
		marks = [
			{
				"question": q,
				"correct": i < len(answers) and cint(answers[i]) == cint(bank[q].get("answer_index")),
				"answer_index": bank[q].get("answer_index"),
				"explanation": bank[q].get("explanation"),
				"source": bank[q].get("source"),
			}
			for i, q in enumerate(selected)
		]
		score = round(100 * sum(m["correct"] for m in marks) / len(marks)) if marks else 0
		result = {"score": score, "passed": int(score >= flt(_threshold(assignment.goal))), "marks": marks}
	else:
		frappe.throw(_("Role-plays are finished with finish_roleplay."), title=_("Wrong Activity"))
	_save_evidence(
		assignment,
		index,
		activity,
		status="Graded",
		score=result["score"],
		passed=result["passed"],
		response=response | {key: result[key] for key in ("marks",) if key in result},
		feedback=result.get("feedback"),
	)
	return result | {"state": refresh_assignment(assignment.name)}


def start_check(assignment_name: str, index: int, fresh: bool = False) -> list[dict]:
	"""The questions this learner answers in a check: every key idea once, extra ones on their weak
	spots. A retry picks again."""
	assignment = get_assignment(assignment_name)
	activity, content = _activity(assignment.goal, index)
	if activity.activity_type != "Check":
		frappe.throw(_("This activity is not a check."), title=_("Wrong Activity"))
	bank = content.get("questions") or []
	return [
		{"question": bank[q].get("question"), "options": bank[q].get("options")}
		for q in ideas.check_questions(assignment, index, bank, fresh=fresh)
	]


def start_roleplay(assignment_name: str, index: int) -> str:
	from frappe.flow.lib.session import new_session

	assignment = get_assignment(assignment_name)
	activity, content = _activity(assignment.goal, index)
	if activity.activity_type != "Role-play":
		frappe.throw(_("This activity is not a role-play."), title=_("Wrong Activity"))
	session = new_session(setup.ROLE_PLAY, title=activity.title, approval_mode="Auto-approve")
	session.chat(_roleplay_brief(content))
	_save_evidence(assignment, index, activity, status="Recorded", flow_session=session.name, passed=0)
	return session.name


def start_teaching(assignment_name: str, index: int) -> str:
	"""Open a one-to-one teaching conversation with Lumi for the goal's lesson."""
	from frappe.flow.lib.session import new_session

	assignment = get_assignment(assignment_name)
	activity, content = _activity(assignment.goal, index)
	if activity.activity_type != "Lesson":
		frappe.throw(_("This activity is not a lesson."), title=_("Wrong Activity"))
	if not frappe.db.exists("Flow Agent", setup.TEACHER):
		# nosemgrep: frappe-setuser - agents are created as the system; the learner is put back in finally
		frappe.set_user("Administrator")
		try:
			setup.ensure_agents()
		finally:
			# nosemgrep: frappe-setuser - restores the learner after a system step
			frappe.set_user(assignment.member)
	goal = frappe.get_doc("LMS Goal", assignment.goal)
	frappe.db.set_value("LMS Goal Assignment", assignment.name, "tutor_persona", characters.TUTOR_NAME)
	session = new_session(setup.TEACHER, title=activity.title, approval_mode="Auto-approve")
	session.chat(
		"BRIEF\n"
		+ json.dumps(
			{
				"your_name": characters.TUTOR_NAME,
				"learner_first_name": (
					frappe.db.get_value("User", assignment.member, "first_name") or ""
				).strip(),
				"they_need_to_be_able_to": goal.learner_outcome or goal.title,
				"has_material": has_material(goal.name),
				"key_ideas": [
					{"idea": idea["idea"], "heading": idea["heading"], "body": idea["body"]}
					for idea in ideas.key_ideas(goal)
				],
			}
		)
	)
	_save_evidence(assignment, index, activity, status="Recorded", flow_session=session.name, passed=0)
	return session.name


def finish_teaching(session_name: str, user: str, summary: str) -> None:
	name = frappe.db.get_value("LMS Goal Evidence", {"flow_session": session_name, "member": user})
	if not name:
		frappe.throw(_("This conversation is not a lesson."), frappe.PermissionError)
	evidence = frappe.get_doc("LMS Goal Evidence", name)
	evidence.update({"status": "Graded", "passed": 1, "score": None, "feedback": summary})
	# nosemgrep: lms-unjustified-ignore-permissions - the tutor's tool call records the learner's own lesson as done
	evidence.save(ignore_permissions=True)
	refresh_assignment(evidence.assignment)
	frappe.publish_realtime("lms_goal_evidence_graded", {"assignment": evidence.assignment}, user=user)


def finish_roleplay(assignment_name: str, index: int) -> None:
	from frappe.flow.lib.session import new_session

	assignment = get_assignment(assignment_name)
	activity, content = _activity(assignment.goal, index)
	evidence = frappe.get_doc("LMS Goal Evidence", {"assignment": assignment.name, "activity_index": index})
	if not evidence.flow_session:
		frappe.throw(_("Start the role-play first."), title=_("Not Started"))
	transcript = _transcript(evidence.flow_session)
	if not any(turn["speaker"] == "Learner" for turn in transcript):
		frappe.throw(
			_("Reply to the character at least once, then finish."), title=_("Nothing to Review Yet")
		)
	evidence.db_set({"status": "Grading", "response": json.dumps({"transcript": transcript})})
	learner = frappe.session.user
	# nosemgrep: frappe-setuser - grading runs as the system; the learner is put back in finally
	frappe.set_user("Administrator")
	try:
		if not frappe.db.exists("Flow Agent", setup.GRADER):
			setup.ensure_agents()
		grader = new_session(setup.GRADER, title=f"Grade {evidence.name}", approval_mode="Auto-approve")
		grader.chat(
			json.dumps(
				{
					"evidence": evidence.name,
					"brief": {
						k: content.get(k) for k in ("character", "character_role", "setting", "learner_task")
					},
					"rubric": content.get("rubric"),
					"pass_mark": content.get("pass_mark") or 70,
					"transcript": transcript,
				}
			)
		)
	finally:
		# nosemgrep: frappe-setuser - restores the learner after a system step
		frappe.set_user(learner)


def record_grade(evidence_name: str, score: int, passed: bool, criteria: list, feedback: str) -> None:
	evidence = frappe.get_doc("LMS Goal Evidence", evidence_name)
	score = max(0, min(100, cint(score)))
	_row, content = _activity(evidence.goal, evidence.activity_index)
	evidence.update(
		{
			"status": "Graded",
			"score": score,
			# The admin's passing percentage decides, not the grader's own call.
			"passed": int(score >= cint(content.get("pass_mark") or 70)),
			"criteria": json.dumps(criteria),
			"feedback": feedback,
		}
	)
	# nosemgrep: lms-unjustified-ignore-permissions - the grader runs as the system and writes the learner's own evidence
	evidence.save(ignore_permissions=True)
	refresh_assignment(evidence.assignment)
	frappe.publish_realtime(
		"lms_goal_evidence_graded",
		{"assignment": evidence.assignment, "evidence": evidence.name},
		user=evidence.member,
	)


def tutor_session(assignment_name: str) -> str:
	from frappe.flow.lib.session import new_session

	assignment = get_assignment(assignment_name)
	if assignment.tutor_session and frappe.db.exists("Flow Session", assignment.tutor_session):
		return assignment.tutor_session
	session = new_session(setup.TUTOR, title=assignment.goal_title, approval_mode="Auto-approve")
	frappe.db.set_value("LMS Goal Assignment", assignment.name, "tutor_session", session.name)
	return session.name


def acknowledge(assignment_name: str) -> dict:
	assignment = get_assignment(assignment_name)
	frappe.db.set_value("LMS Goal Assignment", assignment.name, "acknowledged_on", now_datetime())
	return refresh_assignment(assignment.name)


def refresh_assignment(assignment_name: str) -> dict:
	"""Recompute progress, mastery and status from the evidence."""
	assignment = frappe.get_doc("LMS Goal Assignment", assignment_name)
	goal = frappe.get_doc("LMS Goal", assignment.goal)
	evidence = _evidence_by_index(assignment.name)
	done = [i for i, row in enumerate(goal.activities) if _is_done(row, evidence.get(i))]
	scores = [
		flt(evidence[i].score)
		for i, row in enumerate(goal.activities)
		if row.activity_type in PRACTICE_TYPES and evidence.get(i) and evidence[i].status == "Graded"
	]
	total = len(goal.activities) or 1
	assignment.progress = round(100 * len(done) / total)
	assignment.score = round(sum(scores) / len(scores)) if scores else 0
	assignment.started_on = assignment.started_on or (now_datetime() if evidence else None)
	assignment.current_step = next(
		(i for i in range(len(goal.activities)) if i not in done), len(goal.activities)
	)
	requirements = {
		"activities": len(done) == len(goal.activities),
		"mastery": not goal.proof_mastery or assignment.score >= flt(goal.mastery_threshold),
		"acknowledgement": not goal.proof_acknowledgement or bool(assignment.acknowledged_on),
		"sign_off": not goal.proof_sign_off or bool(assignment.signed_off_by),
	}
	ready = all(requirements.values())
	assignment.status = "Ready" if ready else ("In Progress" if evidence else "Assigned")
	assignment.ready_on = (assignment.ready_on or now_datetime()) if ready else None
	# nosemgrep: lms-unjustified-ignore-permissions - readiness is computed by the system; learners cannot write their assignment
	assignment.save(ignore_permissions=True)
	return {
		"status": assignment.status,
		"progress": assignment.progress,
		"score": assignment.score,
		"current_step": assignment.current_step,
		"requirements": requirements,
	}


def get_assignment(name: str):
	assignment = frappe.get_doc("LMS Goal Assignment", name)
	if assignment.member != frappe.session.user:
		frappe.throw(_("This goal belongs to someone else's learning."), frappe.PermissionError)
	return assignment


# Readiness


def goal_readiness() -> list[dict]:
	return [
		skill_summary(goal)
		for goal in frappe.get_all(
			"LMS Goal",
			filters={"status": "Published"},
			pluck="name",
			order_by="published_on desc",
		)
	]


def skill_summary(goal_name: str) -> dict:
	"""How far a skill's people are, and where they struggle: one skill's dashboard."""
	goal = frappe.db.get_value("LMS Goal", goal_name, ["name", "title", "due_date", "status"], as_dict=True)
	assignments = frappe.get_all(
		"LMS Goal Assignment",
		filters={"goal": goal.name, "is_preview": 0},
		fields=["status", "due_date", "score"],
	)
	overdue = [
		a for a in assignments if a.status != "Ready" and a.due_date and getdate(a.due_date) < getdate()
	]
	scored = [flt(a.score) for a in assignments if a.status != "Assigned" and a.score]
	return {
		"goal": goal.name,
		"title": goal.title,
		"status": goal.status,
		"due_date": goal.due_date,
		"assigned": len(assignments),
		"ready": sum(a.status == "Ready" for a in assignments),
		"in_progress": sum(a.status == "In Progress" for a in assignments),
		"not_started": sum(a.status == "Assigned" for a in assignments),
		"overdue": len(overdue),
		"average_score": round(sum(scored) / len(scored)) if scored else None,
		"insight": _most_missed(goal.name),
		"insights": ideas.insights(goal.name),
	}


def _most_missed(goal_name: str) -> dict | None:
	"""The check question learners get wrong most often, and the source it comes from."""
	goal = frappe.get_doc("LMS Goal", goal_name)
	misses: dict[tuple[int, int], int] = {}
	attempts: dict[tuple[int, int], int] = {}
	for evidence in frappe.get_all(
		"LMS Goal Evidence",
		filters={"goal": goal_name, "activity_type": "Check", "activity_index": (">=", 0)},
		fields=["activity_index", "response"],
	):
		marks = (json.loads(evidence.response or "{}")).get("marks") or []
		for position, mark in enumerate(marks):
			key = (evidence.activity_index, cint(mark.get("question", position)))
			attempts[key] = attempts.get(key, 0) + 1
			misses[key] = misses.get(key, 0) + (0 if mark.get("correct") else 1)
	if not misses or not max(misses.values()):
		return None
	(activity_index, q), missed = max(misses.items(), key=lambda item: item[1])
	# Evidence outlives revisions: the check may have fewer questions now than when it was answered.
	if activity_index >= len(goal.activities):
		return None
	questions = json.loads(goal.activities[activity_index].content or "{}").get("questions", [])
	if q >= len(questions):
		return None
	question = questions[q]
	return {
		"question": question.get("question"),
		"source": question.get("source"),
		"missed": missed,
		"attempts": attempts[(activity_index, q)],
	}


def people(goal_name: str | None = None) -> list[dict]:
	filters = {"is_preview": 0}
	if goal_name:
		filters["goal"] = goal_name
	rows = frappe.get_all(
		"LMS Goal Assignment",
		filters=filters,
		fields=[
			"name",
			"member",
			"member_name",
			"goal",
			"goal_title",
			"status",
			"due_date",
			"progress",
			"score",
			"ready_on",
			"creation",
		],
		order_by="status desc, member_name asc",
	)
	for row in rows:
		row.overdue = bool(row.due_date and row.status != "Ready" and getdate(row.due_date) < getdate())
	return rows


def evidence_for(assignment_name: str) -> list[dict]:
	return frappe.get_all(
		"LMS Goal Evidence",
		filters={"assignment": assignment_name},
		fields=[
			"activity_index",
			"activity_type",
			"activity_title",
			"status",
			"score",
			"passed",
			"feedback",
			"criteria",
			"response",
			"modified",
		],
		order_by="activity_index asc",
	)


# Helpers


def _activity(goal_name: str, index: int):
	activities = frappe.get_doc("LMS Goal", goal_name).activities
	index = cint(index)
	if not 0 <= index < len(activities):
		frappe.throw(_("That activity does not exist."), title=_("Invalid Activity"))
	row = activities[index]
	return row, json.loads(row.content or "{}")


def _learner_view(index: int, row, evidence) -> dict:
	"""The activity without what would give the answers away."""
	content = json.loads(row.content or "{}")
	if row.activity_type == "Scenario":
		content["choices"] = [{"text": c.get("text")} for c in content.get("choices") or []]
	elif row.activity_type == "Check":
		# Each learner gets their own questions from the bank, through start_check.
		content = {}
	elif row.activity_type == "Role-play":
		content = {
			key: content.get(key)
			for key in ("cast", "character", "character_role", "setting", "learner_task", "pass_mark")
		} | {
			"criteria": [c.get("criterion") for c in content.get("rubric") or []],
			"exchanges": roleplay_exchanges(content),
		}
	return {
		"index": index,
		"activity_type": row.activity_type,
		"title": row.title,
		"summary": row.summary,
		"minutes": row.minutes,
		"content": content,
		"evidence": evidence
		and {
			"status": evidence.status,
			"score": evidence.score,
			"passed": evidence.passed,
			"feedback": evidence.feedback,
			"criteria": json.loads(evidence.criteria or "[]"),
			"response": json.loads(evidence.response or "{}"),
			"flow_session": evidence.flow_session,
		},
		"done": _is_done(row, evidence),
	}


def _is_done(row, evidence) -> bool:
	if not evidence:
		return False
	if row.activity_type in ("Role-play", "Lesson"):
		return evidence.status == "Graded"
	return True


def _evidence_by_index(assignment_name: str) -> dict:
	return {
		row.activity_index: row
		for row in frappe.get_all(
			"LMS Goal Evidence",
			filters={"assignment": assignment_name},
			fields=[
				"name",
				"activity_index",
				"status",
				"score",
				"passed",
				"feedback",
				"criteria",
				"response",
				"flow_session",
			],
		)
	}


def _save_evidence(assignment, index: int, activity, **values) -> None:
	name = frappe.db.get_value("LMS Goal Evidence", {"assignment": assignment.name, "activity_index": index})
	doc = frappe.get_doc("LMS Goal Evidence", name) if name else frappe.new_doc("LMS Goal Evidence")
	doc.update(
		{
			"assignment": assignment.name,
			"goal": assignment.goal,
			"member": assignment.member,
			"activity_index": index,
			"activity_type": activity.activity_type,
			"activity_title": activity.title,
			**{k: (json.dumps(v) if k == "response" else v) for k, v in values.items()},
		}
	)
	# nosemgrep: lms-unjustified-ignore-permissions - evidence is the system's record of the learner's own session
	doc.save(ignore_permissions=True)


def _threshold(goal_name: str) -> float:
	return flt(frappe.db.get_value("LMS Goal", goal_name, "mastery_threshold")) or 80


ROLEPLAY_EXCHANGES = 4

# Evidence for a step the admin removed: kept for the record, but no longer any step's.
REMOVED_STEP = -1


def activity_moves(goal, incoming: list[dict]) -> dict[int, int] | None:
	"""Where each saved step's position goes in the edited plan, matched by row name.

	Learner evidence is filed by position, so removing or reordering a step must move it.
	None when nothing moves.
	"""
	new_index = {row.get("name"): i for i, row in enumerate(incoming) if row.get("name")}
	moves = {old: new_index.get(row.name, REMOVED_STEP) for old, row in enumerate(goal.activities or [])}
	return moves if any(old != new for old, new in moves.items()) else None


def move_evidence(goal: str, moves: dict[int, int]) -> None:
	"""Refile the goal's evidence after its steps moved, then recount everyone's progress."""
	rows = frappe.get_all(
		"LMS Goal Evidence",
		filters={"goal": goal, "activity_index": ("in", list(moves))},
		fields=["name", "activity_index", "assignment"],
	)
	for row in rows:
		frappe.db.set_value(
			"LMS Goal Evidence", row.name, "activity_index", moves[row.activity_index], update_modified=False
		)
	for assignment in {row.assignment for row in rows}:
		refresh_assignment(assignment)


# Added by the server to the learner's last reply, so the character knows to close. The chat
# and the grader never see it. Kept in step with SYSTEM_NOTE in useFlowChat.ts.
SYSTEM_NOTE = "\n\n[SYSTEM NOTE] "
LAST_REPLY_NOTE = (
	"That was the learner's last reply. Answer it with a short closing line in character, "
	"and ask no new question."
)


def roleplay_reply(session: str, message: str) -> dict:
	"""Send the learner's reply to a role-play, marking their last one so the character closes."""
	from frappe.flow.api.api import run

	row = frappe.db.get_value(
		"LMS Goal Evidence",
		{"flow_session": session, "member": frappe.session.user},
		["goal", "activity_index"],
		as_dict=True,
	)
	if not row or row.activity_index < 0:
		frappe.throw(_("This conversation is not one of your role-plays."), frappe.PermissionError)
	activities = frappe.get_doc("LMS Goal", row.goal).activities
	content = json.loads(activities[row.activity_index].content or "{}")
	replies = sum(1 for turn in _transcript(session) if turn["speaker"] == "Learner")
	limit = roleplay_exchanges(content)
	if replies >= limit:
		frappe.throw(_("That's all your replies. See how you did."), title=_("Conversation Over"))
	if replies + 1 == limit:
		message = message + SYSTEM_NOTE + LAST_REPLY_NOTE
	return run(session, message)


def transcription_hint(session: str, user: str) -> str:
	"""Words Whisper should expect in this conversation: the skill, its key ideas, the cast."""
	row = frappe.db.get_value(
		"LMS Goal Evidence",
		{"flow_session": session, "member": user},
		["goal", "activity_index"],
		as_dict=True,
	)
	if not row:
		return ""
	goal = frappe.get_doc("LMS Goal", row.goal)
	words = [goal.title]
	words += [idea["heading"] for idea in ideas.key_ideas(goal)]
	activities = goal.activities or []
	if 0 <= (row.activity_index or 0) < len(activities):
		content = json.loads(activities[row.activity_index].content or "{}")
		words += [content.get("character"), content.get("setting")]
	words += [member.get("name") for member in characters.CAST.values()]
	return ". ".join(dict.fromkeys(word.strip().rstrip(".") for word in words if word))[:600]


def roleplay_exchanges(content: dict) -> int:
	"""How many times the learner replies before the conversation closes."""
	return min(max(int(content.get("exchanges") or ROLEPLAY_EXCHANGES), 2), 8)


def _roleplay_brief(content: dict) -> str:
	# Setting and task are written to the learner ("you are the member of staff"), so they go
	# under the learner's name: a character handed them as its own plays the learner instead.
	return "BRIEF\n" + json.dumps(
		{
			"you_play": content.get("character"),
			"your_role": content.get("character_role"),
			"personality": " ".join(
				part
				for part in (
					characters.CAST.get(content.get("cast"), {}).get("personality"),
					content.get("personality"),
				)
				if part
			),
			"scene_as_told_to_the_learner": content.get("setting"),
			"what_the_learner_must_do": content.get("learner_task"),
			"your_opening_line": content.get("opening_line"),
			"learner_replies": roleplay_exchanges(content),
		}
	)


def _transcript(session_name: str) -> list[dict]:
	"""The learner and character turns, without the brief that opened the session."""
	from frappe.flow.lib.session import sync_with_retry

	sync_with_retry(frappe.get_doc("Flow Session", session_name))
	messages = frappe.get_all(
		"Flow Session Message",
		filters={"parent": session_name, "role": ("in", ("user", "assistant"))},
		fields=["role", "content"],
		order_by="idx asc",
	)
	turns = [
		{
			"speaker": "Learner" if m.role == "user" else "Character",
			"text": m.content.split(SYSTEM_NOTE)[0],
		}
		for m in messages
		if m.content
	]
	return turns[1:] if turns and turns[0]["text"].startswith("BRIEF") else turns
