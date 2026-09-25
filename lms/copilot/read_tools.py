"""Read tools. They run immediately and never change data."""

import frappe
from frappe import _
from frappe.utils import cint, flt

from lms.copilot import access
from lms.copilot.content import content_hash, lesson_sections, rank_sections
from lms.copilot.validation import existing, integer, load_json, required_text

MAX_SEARCH_RESULTS = 10
SNIPPET_CHARS = 600


def _chapters(course):
	chapters = frappe.get_all(
		"Chapter Reference",
		filters={"parent": course, "parenttype": "LMS Course"},
		fields=["chapter", "idx"],
		order_by="idx asc",
	)
	result = []
	for chapter_ref in chapters:
		title = frappe.db.get_value("Course Chapter", chapter_ref.chapter, "title")
		lesson_refs = frappe.get_all(
			"Lesson Reference",
			filters={"parent": chapter_ref.chapter, "parenttype": "Course Chapter"},
			fields=["lesson", "idx"],
			order_by="idx asc",
		)
		lessons = []
		for lesson_ref in lesson_refs:
			lesson = frappe.db.get_value(
				"Course Lesson", lesson_ref.lesson, ["name", "title", "include_in_preview"], as_dict=True
			)
			if lesson:
				lessons.append(
					{
						"lesson": lesson.name,
						"title": lesson.title,
						"number": f"{chapter_ref.idx}.{lesson_ref.idx}",
						"preview": cint(lesson.include_in_preview),
					}
				)
		result.append(
			{"chapter": chapter_ref.chapter, "title": title, "number": chapter_ref.idx, "lessons": lessons}
		)
	return result


def _course_lessons(course):
	"""Lessons in outline order, falling back to every lesson of the course."""
	ordered = [lesson["lesson"] for chapter in _chapters(course) for lesson in chapter["lessons"]]
	if ordered:
		return ordered
	return frappe.get_all("Course Lesson", filters={"course": course}, pluck="name", order_by="creation asc")


def get_course_outline(course):
	course = existing("LMS Course", course, _("Course"))
	access.assert_course_reader(course)
	details = frappe.db.get_value(
		"LMS Course", course, ["title", "published", "short_introduction"], as_dict=True
	)
	return {
		"course": course,
		"title": details.title,
		"published": cint(details.published),
		"introduction": details.short_introduction,
		"chapters": _chapters(course),
	}


def _lesson(lesson):
	lesson = existing("Course Lesson", lesson, _("Lesson"))
	return frappe.get_doc("Course Lesson", lesson)


def get_lesson_content(lesson):
	doc = _lesson(lesson)
	access.assert_course_reader(doc.course)
	teacher = access.can_teach_course(doc.course) or access.is_engine()
	if not teacher:
		published = frappe.db.get_value("LMS Course", doc.course, "published")
		if not published and not cint(doc.include_in_preview):
			frappe.throw(_("This lesson is not open yet."), frappe.PermissionError)
	result = {
		"lesson": doc.name,
		"title": doc.title,
		"course": doc.course,
		"chapter": doc.chapter,
		"version": content_hash(doc.content),
		"sections": lesson_sections(doc),
	}
	if teacher:
		result["instructor_notes"] = doc.instructor_notes
	return result


def search_course_content(course, query, limit=5):
	"""Rank lesson blocks by term overlap and return citable snippets."""
	course = existing("LMS Course", course, _("Course"))
	access.assert_course_reader(course)
	query = required_text(query, _("Query"), 500)
	limit = integer(limit, _("Limit"), minimum=1, maximum=MAX_SEARCH_RESULTS)
	sections = []
	for lesson_name in _course_lessons(course):
		lesson = frappe.get_doc("Course Lesson", lesson_name)
		for section in lesson_sections(lesson):
			sections.append({**section, "lesson": lesson.name, "lesson_title": lesson.title})

	results = []
	for score, section in rank_sections(query, sections)[:limit]:
		results.append(
			{
				"lesson": section["lesson"],
				"lesson_title": section["lesson_title"],
				"block_id": section["block_id"],
				"heading": section["heading"],
				"snippet": section["text"][:SNIPPET_CHARS],
				"citation": f"{section['lesson_title']}"
				+ (f" · {section['heading']}" if section["heading"] else ""),
				"score": round(score, 3),
			}
		)
	return {"query": query, "results": results}


def rubric_for_assignment(assignment):
	name = frappe.db.get_value("Copilot Rubric", {"assignment": assignment}, "name", order_by="modified desc")
	return frappe.get_doc("Copilot Rubric", name) if name else None


def serialise_rubric(rubric, for_learner=False):
	if not rubric:
		return None
	criteria = []
	for row in rubric.criteria:
		item = {
			"criterion": row.criterion,
			"description": row.description,
			"max_level": cint(row.max_level) or 3,
			"points": flt(row.get("points")) or None,
			"levels": row.get("levels"),
			"taught_in_lesson": row.get("taught_in_lesson"),
		}
		if not for_learner:
			item["pass_example"] = row.pass_example
			item["fail_example"] = row.fail_example
		criteria.append(item)
	result = {"rubric": rubric.name, "title": rubric.title, "criteria": criteria}
	if not for_learner:
		result["notes"] = rubric.notes
		result["visible_to_learner"] = cint(rubric.visible_to_learner)
	return result


def assignment_course(assignment_doc):
	if assignment_doc.get("course"):
		return assignment_doc.course
	return frappe.db.get_value("Copilot Project Submission", {"assignment": assignment_doc.name}, "course")


def get_assignment_and_rubric(assignment):
	assignment = existing("LMS Assignment", assignment, _("Assignment"))
	doc = frappe.get_doc("LMS Assignment", assignment)
	course = assignment_course(doc)
	if not access.is_engine():
		if course:
			access.assert_reviewer(course)
		elif not access.REVIEWER_ROLES & access.roles() and not access.is_admin():
			frappe.throw(_("You cannot review this assignment."), frappe.PermissionError)
	return {
		"assignment": doc.name,
		"title": doc.title,
		"type": doc.type,
		"question": doc.question,
		"course": course,
		"rubric": serialise_rubric(rubric_for_assignment(doc.name)),
	}


def serialise_tests(project_submission):
	return {
		"passed": cint(project_submission.tests_passed),
		"total": cint(project_submission.tests_total),
		"tested_on": project_submission.tested_on,
		"results": load_json(project_submission.test_results, []),
	}


def get_submission(project_submission):
	name = existing("Copilot Project Submission", project_submission, _("Project submission"))
	doc = frappe.get_doc("Copilot Project Submission", name)
	access.assert_engine_or_reviewer(doc.course)
	return {
		"project_submission": doc.name,
		"assignment": doc.assignment,
		"course": doc.course,
		"lesson": doc.lesson,
		"learner": access.learner_ref(doc.member),
		"repo_url": doc.repo_url,
		"commit": doc.commit_sha,
		"status": doc.status,
		"tests": serialise_tests(doc),
		"attempt": frappe.db.count(
			"Copilot Project Submission",
			{"assignment": doc.assignment, "member": doc.member, "creation": ["<=", doc.creation]},
		),
		"completed_lessons": completed_lessons(doc.course, doc.member),
	}


def completed_lessons(course, member):
	"""Lessons the learner finished, in outline order, so feedback only builds on what was taught."""
	if not course or not member:
		return []
	done = set(
		frappe.get_all(
			"LMS Course Progress",
			filters={"course": course, "member": member, "status": "Complete"},
			pluck="lesson",
		)
	)
	if not done:
		return []
	titles = dict(
		frappe.get_all(
			"Course Lesson", filters={"name": ["in", list(done)]}, fields=["name", "title"], as_list=True
		)
	)
	ordered = [lesson for lesson in _course_lessons(course) if lesson in done]
	ordered += sorted(done - set(ordered))
	return [{"lesson": lesson, "title": titles.get(lesson)} for lesson in ordered if lesson in titles]


def get_rewrite_context(project_submission, rewrite_of):
	"""The draft a teacher sent back, with their note and edits, for the review agent's rewrite."""
	name = existing("Copilot Project Submission", project_submission, _("Project submission"))
	project = frappe.get_doc("Copilot Project Submission", name)
	access.assert_engine_or_reviewer(project.course)
	draft_name = existing("Copilot Feedback Draft", rewrite_of, _("Feedback draft"))
	draft = frappe.get_doc("Copilot Feedback Draft", draft_name)
	if draft.assignment != project.assignment or draft.member != project.member:
		frappe.throw(
			_("That feedback draft does not belong to this learner's submissions for the assignment."),
			frappe.PermissionError,
		)
	reviewer = draft.reviewed_by
	return {
		"project_submission": project.name,
		"rewrite_of": draft.name,
		"assignment": project.assignment,
		"learner": access.learner_ref(project.member),
		"previous": {
			"project_submission": draft.project_submission,
			"status": draft.status,
			"confidence": draft.confidence,
			"model": draft.model,
			"drafted_on": draft.creation,
			"message": draft.message,
			"scores": [
				{
					"criterion": row.criterion,
					"max_level": cint(row.max_level) or 3,
					"level": cint(row.level),
					"confidence": row.confidence,
					"reason": row.reason,
					"citations": load_json(row.citations, []),
				}
				for row in draft.scores
			],
		},
		"teacher": {
			"note": draft.review_note,
			"requested_by": reviewer,
			"requested_by_name": frappe.db.get_value("User", reviewer, "full_name") if reviewer else None,
			"requested_on": draft.reviewed_on,
			"edited_message": draft.final_message
			if draft.final_message and draft.final_message != draft.message
			else None,
			"edited_levels": [
				{"criterion": row.criterion, "level": cint(row.level), "final_level": cint(row.final_level)}
				for row in draft.scores
				if row.final_level and cint(row.final_level) != cint(row.level)
			],
		},
	}


def get_learner_progress(course):
	"""Per-learner progress for a teacher. Learners are identified only by pseudonym."""
	course = existing("LMS Course", course, _("Course"))
	access.assert_teacher(course)
	enrollments = frappe.get_all(
		"LMS Enrollment", filters={"course": course}, fields=["member", "progress", "modified"]
	)
	learners = []
	for enrollment in enrollments:
		member = enrollment.member
		quiz_scores = frappe.get_all(
			"LMS Quiz Submission",
			filters={"member": member, "course": course},
			fields=["quiz", "percentage"],
		)
		submissions = frappe.get_all(
			"Copilot Project Submission",
			filters={"member": member, "course": course},
			fields=["assignment", "status", "tests_passed", "tests_total", "creation"],
			order_by="creation desc",
		)
		learners.append(
			{
				"learner": access.learner_ref(member),
				"progress": enrollment.progress or 0,
				"last_activity": enrollment.modified,
				"quizzes": [{"quiz": row.quiz, "percentage": row.percentage} for row in quiz_scores],
				"project_submissions": [
					{
						"assignment": row.assignment,
						"status": row.status,
						"tests": f"{cint(row.tests_passed)}/{cint(row.tests_total)}",
						"submitted_on": row.creation,
					}
					for row in submissions
				],
			}
		)
	return {"course": course, "learners": learners}
