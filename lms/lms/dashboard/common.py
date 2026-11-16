# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""Helpers the course and batch dashboards share: filters, paging, trends, reminders and the analytics report."""

import re
from datetime import timedelta

import frappe
from frappe import _
from frappe.query_builder import Case, Order
from frappe.utils import (
	add_days,
	cint,
	flt,
	format_date,
	get_datetime,
	getdate,
	nowdate,
)
from pypika import functions as fn

from lms.lms.utils import _latest_exercise_submissions

DASHBOARD_STAGES = ("not_started", "in_progress", "completed", "certified")


# Filters that are not stages: `inactive` narrows `in_progress`, `active` is anyone
# with activity in the last week, and the funnel steps are cumulative, each holding
# every student who got at least that far.
FUNNEL_FILTERS = ("started", "halfway", "finished", "evaluation_requested")


STUDENT_FILTERS = (*DASHBOARD_STAGES, "inactive", "active", *FUNNEL_FILTERS)


INACTIVE_AFTER_DAYS = 14


DELTA_WINDOW_DAYS = 30


TREND_WEEKS = 12


MAX_STUDENT_PAGE_LENGTH = 100


MAX_STUDENT_SEARCH_LENGTH = 140


def _lesson_assessment_results(lessons: list[str], member: str) -> dict:
	"""The member's result on each quiz, assignment and programming exercise the lessons hold,
	by lesson."""
	if not lessons:
		return {}
	LessonAssessment = frappe.qb.DocType("LMS Lesson Assessment")
	Quiz = frappe.qb.DocType("LMS Quiz")
	QuizSubmission = frappe.qb.DocType("LMS Quiz Submission")
	Assignment = frappe.qb.DocType("LMS Assignment")
	AssignmentSubmission = frappe.qb.DocType("LMS Assignment Submission")
	links = (
		frappe.qb.from_(LessonAssessment)
		.select(LessonAssessment.parent, LessonAssessment.assessment_type, LessonAssessment.assessment_name)
		.where(
			LessonAssessment.parent.isin(lessons)
			& LessonAssessment.assessment_type.isin(
				["LMS Quiz", "LMS Assignment", "LMS Programming Exercise"]
			)
			& (fn.Coalesce(LessonAssessment.instructor_only, 0) == 0)
		)
		.orderby(LessonAssessment.idx)
		.run(as_dict=True)
	)
	quiz_names = [link.assessment_name for link in links if link.assessment_type == "LMS Quiz"] or [""]
	assignment_names = [
		link.assessment_name for link in links if link.assessment_type == "LMS Assignment"
	] or [""]
	quizzes = {
		row.name: row
		for row in frappe.qb.from_(Quiz)
		.left_join(QuizSubmission)
		.on((QuizSubmission.quiz == Quiz.name) & (QuizSubmission.member == member))
		.select(
			Quiz.name,
			Quiz.title,
			fn.Max(QuizSubmission.percentage).as_("score"),
			fn.Max(
				Case()
				.when(
					fn.Coalesce(QuizSubmission.percentage, 0)
					>= fn.Coalesce(QuizSubmission.passing_percentage, 0),
					1,
				)
				.else_(0)
			).as_("passed"),
			fn.Count(QuizSubmission.name).as_("attempts"),
			fn.Max(QuizSubmission.creation).as_("at"),
		)
		.where(Quiz.name.isin(quiz_names))
		.groupby(Quiz.name, Quiz.title)
		.run(as_dict=True)
	}
	assignments = {}
	for row in (
		frappe.qb.from_(Assignment)
		.left_join(AssignmentSubmission)
		.on((AssignmentSubmission.assignment == Assignment.name) & (AssignmentSubmission.member == member))
		.select(
			Assignment.name,
			Assignment.title,
			AssignmentSubmission.status,
			AssignmentSubmission.creation.as_("at"),
		)
		.where(Assignment.name.isin(assignment_names))
		.orderby(AssignmentSubmission.creation, order=Order.desc)
		.run(as_dict=True)
	):
		assignments.setdefault(row.name, row)
	exercise_names = [
		link.assessment_name for link in links if link.assessment_type == "LMS Programming Exercise"
	]
	exercises = dict(
		frappe.get_all(
			"LMS Programming Exercise",
			filters={"name": ["in", exercise_names or [""]]},
			fields=["name", "title"],
			as_list=True,
		)
	)
	exercise_submissions = _latest_exercise_submissions(exercise_names, member)

	statuses = {
		"Pass": "passed",
		"Fail": "failed",
		"Not Graded": "to_review",
		"Passed": "passed",
		"Failed": "failed",
	}
	by_lesson = {}
	for link in links:
		if link.assessment_type == "LMS Quiz" and link.assessment_name in quizzes:
			quiz = quizzes[link.assessment_name]
			attempts = cint(quiz.attempts)
			result = {
				"type": "quiz",
				"name": quiz.name,
				"title": quiz.title or quiz.name,
				"status": ("passed" if quiz.passed else "failed") if attempts else "not_attempted",
				"score": flt(quiz.score, 1) if attempts else None,
				"attempts": attempts,
				"at": quiz.at,
			}
		elif link.assessment_type == "LMS Assignment" and link.assessment_name in assignments:
			assignment = assignments[link.assessment_name]
			result = {
				"type": "assignment",
				"name": assignment.name,
				"title": assignment.title or assignment.name,
				"status": statuses.get(assignment.status, "not_attempted")
				if assignment.at
				else "not_attempted",
				"score": None,
				"attempts": 1 if assignment.at else 0,
				"at": assignment.at,
			}
		elif link.assessment_type == "LMS Programming Exercise" and link.assessment_name in exercises:
			submission = exercise_submissions.get(link.assessment_name)
			result = {
				"type": "exercise",
				"name": link.assessment_name,
				"title": exercises[link.assessment_name] or link.assessment_name,
				"status": statuses.get(submission.status, "not_attempted") if submission else "not_attempted",
				"score": None,
				"attempts": 1 if submission else 0,
				"at": submission.creation if submission else None,
			}
		else:
			continue
		by_lesson.setdefault(link.parent, []).append(result)
	return by_lesson


def _quiz_attempts(quizzes: list[dict], member: str) -> list[dict]:
	"""Every attempt the member made at the quizzes, oldest first, each numbered within its quiz
	and carrying how many attempts the quiz had in all."""
	titles = {quiz["name"]: quiz["title"] for quiz in quizzes}
	QuizSubmission = frappe.qb.DocType("LMS Quiz Submission")
	rows = (
		frappe.qb.from_(QuizSubmission)
		.select(
			QuizSubmission.quiz,
			QuizSubmission.percentage,
			QuizSubmission.passing_percentage,
			QuizSubmission.creation,
		)
		.where((QuizSubmission.member == member) & QuizSubmission.quiz.isin(list(titles) or [""]))
		.orderby(QuizSubmission.creation)
		.run(as_dict=True)
	)
	totals = {}
	for row in rows:
		totals[row.quiz] = totals.get(row.quiz, 0) + 1
	numbers = {}
	attempts = []
	for row in rows:
		numbers[row.quiz] = numbers.get(row.quiz, 0) + 1
		passed = flt(row.percentage) >= flt(row.passing_percentage)
		attempts.append(
			{
				"kind": "quiz_passed" if passed else "quiz_failed",
				"title": titles[row.quiz],
				"score": flt(row.percentage, 1),
				"attempt": numbers[row.quiz],
				"attempts": totals[row.quiz],
				"at": row.creation,
			}
		)
	return attempts


ANALYTICS_FILE_FORMATS = ("xlsx", "pdf")


ANALYTICS_PREVIEW_FORMATS = (*ANALYTICS_FILE_FORMATS, "png")


def _analytics_report(*, window: tuple, enrolled: int, kpis, funnel, **fields) -> frappe._dict:
	if window[0] or window[1]:
		note = _(
			"Covers the {0} students who enrolled in this time frame. Their progress, activity and certificates are as of today."
		).format(enrolled)
	else:
		note = _("Covers every enrolled student. Progress, activity and certificates are as of today.")
	return frappe._dict(
		{"classes": None, **fields},
		time_frame=_time_frame_label(window),
		generated_on=format_date(nowdate()),
		kpis=[{"label": label, "value": value, "suffix": suffix} for label, value, suffix in kpis],
		funnel=[
			{"label": label, "count": count, "percent": _percent(count, enrolled)} for label, count in funnel
		],
		note=note,
	)


def _validate_file_format(file_format, allowed: tuple = ANALYTICS_FILE_FORMATS) -> str:
	if not isinstance(file_format, str) or file_format not in allowed:
		frappe.throw(
			_("File format must be one of {0}, got {1}.").format(", ".join(allowed), repr(file_format)),
			title=_("Invalid file format"),
		)
	return file_format


def _validate_time_frame(from_date, to_date) -> tuple:
	"""The window as `(first day, last day)`, either end open; both days count in full."""
	window = (_parse_report_date(_("From date"), from_date), _parse_report_date(_("To date"), to_date))
	if window[0] and window[1] and window[0] > window[1]:
		frappe.throw(
			_(
				"The from date {0} is after the to date {1}. Pick a from date on or before the to date."
			).format(window[0], window[1]),
			title=_("Invalid time frame"),
		)
	return window


def _parse_report_date(label: str, value):
	if value is None or value == "":
		return None
	if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
		frappe.throw(
			_("{0} must be a date written as YYYY-MM-DD, got {1}.").format(label, repr(value)),
			title=_("Invalid time frame"),
		)
	try:
		return getdate(value)
	except (ValueError, frappe.ValidationError):
		frappe.throw(_("{0} {1} is not a calendar date.").format(label, value), title=_("Invalid time frame"))


def _enrolled_within(query, Enrollment, window: tuple):
	start, end = window
	if start:
		query = query.where(Enrollment.creation >= get_datetime(start))
	if end:
		query = query.where(Enrollment.creation < get_datetime(add_days(end, 1)))
	return query


def _time_frame_label(window: tuple) -> str:
	start, end = window
	if start and end:
		return _("{0} to {1}").format(format_date(start), format_date(end))
	if start:
		return _("Since {0}").format(format_date(start))
	if end:
		return _("Until {0}").format(format_date(end))
	return _("All time")


def _report_date(value) -> str:
	return format_date(getdate(value)) if value else ""


def _newest_first(query, Enrollment):
	return query.orderby(Enrollment.creation, order=Order.desc).orderby(Enrollment.name, order=Order.desc)


def _payment_labels() -> dict:
	return {"Paid": _("Paid"), "Pending": _("Pending"), "Free": _("Free")}


def _sheet_datetime(value) -> str | None:
	return get_datetime(value).strftime("%Y-%m-%d %H:%M:%S") if value else None


def _validate_stage(stage, allowed: tuple[str, ...] = STUDENT_FILTERS) -> str | None:
	if stage is None or stage == "":
		return None
	if not isinstance(stage, str) or stage not in allowed:
		frappe.throw(
			_("Stage must be one of {0}, got {1}.").format(", ".join(allowed), repr(stage)),
			title=_("Invalid stage"),
		)
	return stage


def _validate_search(search) -> str | None:
	if search is None:
		return None
	if not isinstance(search, str):
		frappe.throw(_("Search must be text."), title=_("Invalid search"))
	search = search.strip()
	if len(search) > MAX_STUDENT_SEARCH_LENGTH:
		frappe.throw(
			_("Search can be at most {0} characters long.").format(MAX_STUDENT_SEARCH_LENGTH),
			title=_("Invalid search"),
		)
	return search or None


def _clamp_page(start, page_length) -> tuple[int, int]:
	for label, value in (("start", start), ("page_length", page_length)):
		if not isinstance(value, int) or isinstance(value, bool):
			frappe.throw(
				_("{0} must be a whole number, got {1}.").format(label, repr(value)),
				title=_("Invalid page"),
			)
	return max(start, 0), min(max(page_length, 1), MAX_STUDENT_PAGE_LENGTH)


def _escape_like(text: str) -> str:
	return re.sub(r"([\\%_])", r"\\\1", text)


def _count_where(condition):
	return fn.Sum(Case().when(condition, 1).else_(0))


def _review_backlog_counts(query, Submission, checkpoints: list) -> list[int]:
	"""How many of the query's assignment submissions were waiting for a grade at each checkpoint.
	A graded one counts as waiting until it was last modified, which is when it was graded
	unless it was edited after."""
	waiting = query.select(
		*(
			_count_where(
				(Submission.creation < at)
				& ((Submission.status == "Not Graded") | (Submission.modified >= at))
			)
			for at in checkpoints
		)
	).run()[0]
	return [cint(count) for count in waiting]


def _month_ago(now):
	return add_days(now, -DELTA_WINDOW_DAYS)


def _percent(part, whole) -> float | None:
	return flt(cint(part) * 100 / cint(whole), 1) if cint(whole) else None


def _trend_weeks(now) -> list:
	"""Monday of each of the last TREND_WEEKS weeks, oldest first, ending with this one."""
	this_week = getdate(now) - timedelta(days=getdate(now).weekday())
	return [this_week - timedelta(weeks=TREND_WEEKS - 1 - index) for index in range(TREND_WEEKS)]


def _week_index(column, weeks: list):
	bounds = [*weeks, weeks[-1] + timedelta(weeks=1)]
	case = Case()
	for index in range(len(weeks)):
		case = case.when((column >= str(bounds[index])) & (column < str(bounds[index + 1])), index)
	return case


def _weekly_values(query, column, weeks: list, measure) -> dict:
	week = _week_index(column, weeks)
	end = weeks[-1] + timedelta(weeks=1)
	return dict(
		query.select(week.as_("week"), measure)
		.where((column >= str(weeks[0])) & (column < str(end)))
		.groupby(week)
		.run()
	)


def _weekly_counts(query, column, weeks: list, count=None) -> list[int]:
	by_week = _weekly_values(query, column, weeks, count or fn.Count("*"))
	return [cint(by_week.get(index)) for index in range(len(weeks))]


def _windowed_counts(query, column, measure_of, now) -> dict:
	"""`measure_of(condition)` over the last DELTA_WINDOW_DAYS and the window before it."""
	window_start = _month_ago(now)
	previous_start = add_days(now, -2 * DELTA_WINDOW_DAYS)
	current, previous = query.select(
		measure_of(column >= window_start),
		measure_of((column >= previous_start) & (column < window_start)),
	).run()[0]
	return {"current": cint(current), "previous": cint(previous)}


def _quiz_rows(attempts, Submission, own: list) -> list[dict]:
	"""Per quiz attempt counts from `attempts`, a query over quiz submissions, alongside `own`."""
	Quiz = frappe.qb.DocType("LMS Quiz")
	score = fn.Coalesce(Submission.percentage, 0)
	attempted = (
		attempts.left_join(Quiz)
		.on(Quiz.name == Submission.quiz)
		.select(
			Submission.quiz.as_("name"),
			fn.Max(fn.Coalesce(Quiz.title, Submission.quiz_title)).as_("title"),
			fn.Count(Submission.name).as_("attempts"),
			fn.Count(Submission.member).distinct().as_("students"),
			_count_where(score >= fn.Coalesce(Submission.passing_percentage, 0)).as_("passed"),
			fn.Avg(score).as_("average_score"),
		)
		.groupby(Submission.quiz)
		.run(as_dict=True)
	)
	return _assessment_rows(own, attempted, _quiz_row)


def _quiz_row(quiz: frappe._dict) -> dict:
	attempts = cint(quiz.attempts)
	return {
		"name": quiz.name,
		"title": quiz.title or quiz.name,
		"attempts": attempts,
		"students": cint(quiz.students),
		"passed": cint(quiz.passed),
		"pass_rate": flt(cint(quiz.passed) * 100 / attempts, 1) if attempts else None,
		"average_score": flt(quiz.average_score, 1) if attempts else None,
	}


def _assignment_rows(submissions, Submission, own: list) -> list[dict]:
	"""Per assignment grading counts from `submissions`, a query over assignment submissions."""
	Assignment = frappe.qb.DocType("LMS Assignment")
	submitted = (
		submissions.left_join(Assignment)
		.on(Assignment.name == Submission.assignment)
		.select(
			Submission.assignment.as_("name"),
			fn.Max(fn.Coalesce(Assignment.title, Submission.assignment_title)).as_("title"),
			fn.Count(Submission.name).as_("submitted"),
			*(
				_count_where(Submission.status == status).as_(key)
				for key, status in (("passed", "Pass"), ("failed", "Fail"), ("not_graded", "Not Graded"))
			),
		)
		.groupby(Submission.assignment)
		.run(as_dict=True)
	)
	return _assessment_rows(own, submitted, _assignment_row)


def _assignment_row(assignment: frappe._dict) -> dict:
	return {
		"name": assignment.name,
		"title": assignment.title or assignment.name,
		"submitted": cint(assignment.submitted),
		"passed": cint(assignment.passed),
		"failed": cint(assignment.failed),
		"not_graded": cint(assignment.not_graded),
	}


def _assessment_rows(own: list, with_activity: list, to_row) -> list[dict]:
	"""The course's own assessments plus any its students answered from elsewhere, by title."""
	by_name = {row.name: row for row in own}
	by_name.update({row.name: row for row in with_activity})
	return sorted((to_row(row) for row in by_name.values()), key=lambda row: row["title"].lower())


def _payment_status(row: frappe._dict) -> str:
	if not row.payment:
		return "Free"
	return "Paid" if row.payment_received else "Pending"


REMINDER_COOLDOWN_SECONDS = 24 * 60 * 60


def _reminder_member(doctype: str, enrollment, field: str, value: str, missing: str) -> str:
	if not isinstance(enrollment, str) or not enrollment:
		frappe.throw(_("Pass the enrollment name as text."), title=_("Invalid enrollment"))
	member = frappe.db.get_value(doctype, {"name": enrollment, field: value}, "member")
	if not member:
		frappe.throw(missing, frappe.DoesNotExistError)
	return member


def _send_reminder(
	doctype: str, enrollment: str, member: str, title: str, route: str, up_next: str | None
) -> dict:
	# INCR is atomic: of two quick clicks only the one that reads 1 sends. A key
	# left without an expiry, e.g. by a crash after INCR, gets one on the next try.
	key = frappe.cache.make_key(f"lms:progress_reminder:{doctype}:{enrollment}")
	claims = frappe.cache.incr(key)
	if claims == 1 or frappe.cache.ttl(key) < 0:
		frappe.cache.expire(key, REMINDER_COOLDOWN_SECONDS)
	if claims > 1:
		frappe.throw(
			_("A reminder already went to this student in the last day."),
			title=_("Reminder already sent"),
		)
	student_name = frappe.db.get_value("User", member, "full_name") or member
	try:
		frappe.sendmail(
			recipients=member,
			subject=_("Pick up where you left off in {0}").format(title),
			template="progress_reminder",
			args={
				"student_name": student_name,
				"sender_name": frappe.utils.get_fullname(frappe.session.user),
				"title": title,
				"route": route,
				"up_next": up_next,
			},
			header=[_("Keep going: {0}").format(title), "blue"],
		)
	except Exception:
		# No reminder went out, so the day's claim is not spent.
		frappe.cache.delete(key)
		raise
	return {"sent_to": student_name}
