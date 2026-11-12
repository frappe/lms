"""Key ideas: what each learner has shown they understand, where they struggled, and the final
check built from that.

The key ideas are the points of a skill's Lesson, numbered from 0. Lumi confirms each one during
teaching, moments record misses against them, and check questions are tagged with the idea they
test. A learner's weak ideas get the extra questions in their check.
"""

import json
import random

import frappe
from frappe import _
from frappe.utils import cint

DEFAULT_CHECK_QUESTIONS = 5


def key_ideas(goal) -> list[dict]:
	"""The skill's key ideas, from its first Lesson."""
	for row in goal.activities:
		if row.activity_type == "Lesson":
			points = json.loads(row.content or "{}").get("points") or []
			return [
				{"idea": i, "heading": p.get("heading"), "body": p.get("body")} for i, p in enumerate(points)
			]
	return []


def progress(assignment) -> dict[int, dict]:
	"""Per idea: confirmed, taught (Lumi had to teach it), misses and confident misses in moments."""
	raw = json.loads(assignment.idea_state or "{}")
	return {cint(key): value for key, value in raw.items()}


def learner_ideas(assignment, goal) -> list[dict]:
	"""The checklist shown beside the teaching chat."""
	state = progress(assignment)
	return [
		{
			"idea": idea["idea"],
			"heading": idea["heading"],
			**{k: bool(state.get(idea["idea"], {}).get(k)) for k in ("confirmed", "taught")},
		}
		for idea in key_ideas(goal)
	]


def confirm(assignment_name: str, idea: int, needed_teaching: bool) -> list[int]:
	"""Mark an idea as understood. Returns the ideas still to confirm."""
	assignment = frappe.get_doc("LMS Goal Assignment", assignment_name)
	goal = frappe.get_doc("LMS Goal", assignment.goal)
	ideas = [i["idea"] for i in key_ideas(goal)]
	if idea not in ideas:
		frappe.throw(_("There is no key idea {0}.").format(idea), title=_("Unknown Key Idea"))
	_update(assignment, idea, confirmed=True, taught=needed_teaching)
	frappe.publish_realtime("lms_goal_ideas", {"assignment": assignment.name}, user=assignment.member)
	return [i for i in ideas if not progress(assignment).get(i, {}).get("confirmed")]


def unconfirmed(assignment_name: str) -> list[dict]:
	assignment = frappe.get_doc("LMS Goal Assignment", assignment_name)
	state = progress(assignment)
	return [
		idea
		for idea in key_ideas(frappe.get_doc("LMS Goal", assignment.goal))
		if not state.get(idea["idea"], {}).get("confirmed")
	]


def record_moment(assignment_name: str, idea: int | None, correct: bool, confidence: str | None) -> None:
	"""Count a missed moment against its idea; a confident miss counts as a misconception."""
	if idea is None or correct:
		return
	assignment = frappe.get_doc("LMS Goal Assignment", assignment_name)
	if not 0 <= cint(idea) < len(key_ideas(frappe.get_doc("LMS Goal", assignment.goal))):
		return
	entry = progress(assignment).get(cint(idea), {})
	sure = confidence in ("fairly sure", "certain")
	_update(
		assignment,
		cint(idea),
		misses=cint(entry.get("misses")) + 1,
		sure_misses=cint(entry.get("sure_misses")) + int(sure),
	)


def weakness(entry: dict) -> int:
	"""How much an idea needs another look: re-taught, missed, or confidently wrong."""
	return 2 * int(bool(entry.get("taught"))) + cint(entry.get("misses")) + 2 * cint(entry.get("sure_misses"))


def check_questions(assignment, index: int, questions: list[dict], fresh: bool = False) -> list[int]:
	"""The questions this learner gets in the check at `index`, picked once and kept for grading."""
	selection = json.loads(assignment.check_selection or "{}")
	if not fresh and str(index) in selection:
		return selection[str(index)]
	count = (
		cint(frappe.db.get_value("LMS Goal", assignment.goal, "check_questions")) or DEFAULT_CHECK_QUESTIONS
	)
	state = progress(assignment)
	picked = pick(questions, {idea: weakness(entry) for idea, entry in state.items()}, count)
	selection[str(index)] = picked
	assignment.db_set("check_selection", json.dumps(selection), update_modified=False)
	return picked


def pick(questions: list[dict], weak: dict[int, int], count: int) -> list[int]:
	"""Cover every idea once (weakest first if there are too few slots), then give the remaining
	slots to weak ideas. Untagged questions from older plans fill in last."""
	by_idea: dict[int, list[int]] = {}
	untagged = []
	for i, question in enumerate(questions):
		idea = question.get("idea")
		if isinstance(idea, int) and idea >= 0:
			by_idea.setdefault(idea, []).append(i)
		else:
			untagged.append(i)
	for pool in by_idea.values():
		random.shuffle(pool)
	random.shuffle(untagged)

	ideas = sorted(by_idea, key=lambda idea: (-weak.get(idea, 0), random.random()))
	picked = [by_idea[idea].pop() for idea in ideas[:count]]
	for idea in sorted((i for i in ideas if weak.get(i, 0) > 0), key=lambda i: -weak[i]):
		while len(picked) < count and by_idea[idea] and _extra_allowed(idea, picked, questions, weak):
			picked.append(by_idea[idea].pop())
	leftovers = [i for idea in ideas for i in by_idea[idea]] + untagged
	random.shuffle(leftovers)
	picked += leftovers[: max(count - len(picked), 0)]
	return sorted(picked)


def insights(goal_name: str) -> dict:
	"""What a skill's learners struggle with: per idea, and the check questions missed most."""
	goal = frappe.get_doc("LMS Goal", goal_name)
	ideas = key_ideas(goal)
	assignments = frappe.get_all(
		"LMS Goal Assignment",
		filters={"goal": goal_name, "is_preview": 0},
		fields=["idea_state"],
	)
	taught = {idea["idea"]: 0 for idea in ideas}
	sure_misses = dict(taught)
	learned = 0
	for row in assignments:
		state = {cint(k): v for k, v in json.loads(row.idea_state or "{}").items()}
		if state:
			learned += 1
		for idea, entry in state.items():
			if idea in taught:
				taught[idea] += int(bool(entry.get("taught")))
				sure_misses[idea] += int(cint(entry.get("sure_misses")) > 0)
	return {
		"learners": learned,
		"ideas": [
			{
				"heading": idea["heading"],
				"needed_teaching": taught[idea["idea"]],
				"confidently_wrong": sure_misses[idea["idea"]],
			}
			for idea in ideas
		],
		"missed_questions": _missed_questions(goal),
	}


def _missed_questions(goal, limit: int = 3) -> list[dict]:
	misses: dict[tuple[int, int], list[int]] = {}
	for evidence in frappe.get_all(
		"LMS Goal Evidence",
		filters={"goal": goal.name, "activity_type": "Check", "activity_index": (">=", 0)},
		fields=["activity_index", "response"],
	):
		for position, mark in enumerate(json.loads(evidence.response or "{}").get("marks") or []):
			key = (evidence.activity_index, cint(mark.get("question", position)))
			tally = misses.setdefault(key, [0, 0])
			tally[0] += 0 if mark.get("correct") else 1
			tally[1] += 1
	rows = []
	for (activity_index, q), (missed, attempts) in misses.items():
		if not missed or activity_index >= len(goal.activities):
			continue
		questions = json.loads(goal.activities[activity_index].content or "{}").get("questions") or []
		if q < len(questions):
			rows.append(
				{
					"question": questions[q].get("question"),
					"source": questions[q].get("source"),
					"missed": missed,
					"attempts": attempts,
				}
			)
	return sorted(rows, key=lambda row: (-row["missed"] / row["attempts"], -row["missed"]))[:limit]


def _extra_allowed(idea: int, picked: list[int], questions: list[dict], weak: dict[int, int]) -> bool:
	"""At most one extra question per weakness point, so one weak idea can't take the whole check."""
	asked = sum(1 for i in picked if questions[i].get("idea") == idea)
	return asked <= weak.get(idea, 0)


def _update(assignment, idea: int, **values) -> None:
	state = json.loads(assignment.idea_state or "{}")
	entry = state.get(str(idea), {})
	if values.pop("confirmed", False):
		entry["confirmed"] = True
	if values.pop("taught", False):
		entry["taught"] = True
	entry.update(values)
	state[str(idea)] = entry
	assignment.db_set("idea_state", json.dumps(state), update_modified=False)
