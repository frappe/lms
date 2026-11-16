# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""The batch dashboard's endpoints: stats, students, a student's progress, attendance, reminders and analytics."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import frappe
from frappe import _
from frappe.query_builder import Case, Order
from frappe.utils import (
	add_days,
	cint,
	flt,
	get_datetime,
	get_system_timezone,
	get_time,
	getdate,
	now_datetime,
)
from pypika import functions as fn

from lms.lms.analytics_report import IMAGE_STUDENTS, report_html, report_preview, send_analytics
from lms.lms.dashboard.common import (
	ANALYTICS_PREVIEW_FORMATS,
	DELTA_WINDOW_DAYS,
	INACTIVE_AFTER_DAYS,
	_analytics_report,
	_assignment_rows,
	_clamp_page,
	_count_where,
	_enrolled_within,
	_escape_like,
	_lesson_assessment_results,
	_month_ago,
	_newest_first,
	_payment_labels,
	_payment_status,
	_percent,
	_quiz_attempts,
	_quiz_rows,
	_reminder_member,
	_report_date,
	_review_backlog_counts,
	_send_reminder,
	_sheet_datetime,
	_trend_weeks,
	_validate_file_format,
	_validate_search,
	_validate_stage,
	_validate_time_frame,
	_weekly_counts,
	_windowed_counts,
)
from lms.lms.doctype.lms_batch_feedback.lms_batch_feedback import feedback_rows, feedback_summary
from lms.lms.feedback import validate_feedback_page
from lms.lms.permissions import can_author_batch, evaluator_role_reads_batch

BATCH_FILTERS = (
	"on_track",
	"behind",
	"at_risk",
	"not_started",
	"completed",
	"certified",
	"started",
	"evaluation_requested",
	"no_evaluation",
)


AGENDA_CLASSES = 3


AGENDA_DAYS = 7


AGENDA_EVALUATIONS = 20


@frappe.whitelist()
def get_batch_dashboard_stats(batch: str) -> dict:
	"""Schedule, progress, attendance, funnel, agenda and feedback for the batch dashboard."""
	context = _batch_dashboard_context(batch)
	now = context.now
	weeks = _trend_weeks(now)
	checkpoints = [
		*(min(get_datetime(str(week + timedelta(weeks=1))), now) for week in weeks),
		_month_ago(now),
	]
	summary = _batch_summary(context)
	enrolled = cint(summary.enrolled)
	counts = {key: cint(summary[key]) for key in BATCH_FILTERS}
	backlog = _batch_review_backlog(context, [*checkpoints, now])
	attendance = _batch_attendance(context, enrolled)
	Enrollment = frappe.qb.DocType("LMS Batch Enrollment")
	Certificate = frappe.qb.DocType("LMS Certificate")
	certificates = frappe.qb.from_(Certificate).where(Certificate.batch_name == context.name)
	joined = _weekly_counts(
		frappe.qb.from_(Enrollment).where(Enrollment.batch == context.name), Enrollment.creation, weeks
	)

	return {
		"enrolled": enrolled,
		"seat_count": cint(context.seat_count),
		"timeline": context.timeline,
		"counts": counts,
		"funnel": {
			"enrolled": enrolled,
			**{key: counts[key] for key in ("started", "completed", "evaluation_requested", "certified")},
		},
		"attendance": attendance.pop("summary"),
		"awaiting_review": backlog[-1],
		"has_assignments": bool(context.assignments),
		"total_assessments": len(context.assessments),
		"evaluations": {key: cint(summary[key]) for key in ("scheduled", "passed", "failed")},
		"courses": _batch_course_progress(context, enrolled),
		"agenda": _batch_agenda(context),
		"feedback": feedback_summary(context.name),
		"deltas": {
			"enrollments": {
				"current": cint(summary.enrolled_last_window),
				"previous": cint(summary.enrolled_previous_window),
			},
			"attendance_rate": attendance["windows"],
			"awaiting_review": {"current": backlog[-1], "previous": backlog[-2]},
			"certificates": _windowed_counts(
				certificates, Certificate.issue_date, _count_where, getdate(now)
			),
		},
		"weekly": {
			"weeks": [str(week) for week in weeks],
			"enrollments": joined,
			"awaiting_review": backlog[:-2],
			"certificates": _weekly_counts(certificates, Certificate.issue_date, weeks),
			**_batch_weekly_learning(context, weeks, enrolled, joined),
		},
	}


def _batch_weekly_learning(context: frappe._dict, weeks: list, enrolled: int, joined: list[int]) -> dict:
	"""Lessons the batch's students completed each week, and how many of them completed none.

	There is no stored history of who was on track or at risk, so the cards trend on
	what drives both: lessons getting done, and students going quiet."""
	courses = [row.course for row in context.courses]
	if not courses:
		return {"lessons_completed": [0] * len(weeks), "idle": [0] * len(weeks)}
	Enrollment = frappe.qb.DocType("LMS Batch Enrollment")
	Progress = frappe.qb.DocType("LMS Course Progress")
	completions = (
		frappe.qb.from_(Progress)
		.join(Enrollment)
		.on(Enrollment.member == Progress.member)
		.where(
			(Enrollment.batch == context.name)
			& Progress.course.isin(courses)
			& (Progress.status == "Complete")
		)
	)
	lessons = _weekly_counts(completions, Progress.creation, weeks)
	learners = _weekly_counts(completions, Progress.creation, weeks, fn.Count(Progress.member).distinct())
	enrolled_by = enrolled - sum(joined)
	idle = []
	for index, active in enumerate(learners):
		enrolled_by += joined[index]
		idle.append(max(enrolled_by - active, 0))
	return {"lessons_completed": lessons, "idle": idle}


@frappe.whitelist(methods=["GET"])
def get_batch_feedback_list(
	batch: str, low_only: bool = False, start: int = 0, page_length: int = 20
) -> list:
	"""A page of a batch's feedback, newest first. `page_length=0` returns every row."""
	validate_feedback_page(low_only, start, page_length)
	_check_batch_dashboard_access(batch)
	return feedback_rows(batch, low_only=low_only, start=start, page_length=page_length)


@frappe.whitelist()
def get_batch_assessment_stats(batch: str) -> dict:
	"""Attempts and results of the batch's quizzes and assignments, by its enrolled students."""
	context = _batch_dashboard_context(batch)
	Quiz = frappe.qb.DocType("LMS Quiz")
	QuizSubmission = frappe.qb.DocType("LMS Quiz Submission")
	Assignment = frappe.qb.DocType("LMS Assignment")
	AssignmentSubmission = frappe.qb.DocType("LMS Assignment Submission")
	quizzes = _batch_members_only(frappe.qb.from_(QuizSubmission), QuizSubmission, context.name).where(
		_isin(QuizSubmission.quiz, context.quizzes)
	)
	assignments = _batch_members_only(
		frappe.qb.from_(AssignmentSubmission), AssignmentSubmission, context.name
	).where(_isin(AssignmentSubmission.assignment, context.assignments))
	own_quizzes = (
		frappe.qb.from_(Quiz)
		.select(Quiz.name, Quiz.title)
		.where(_isin(Quiz.name, context.quizzes))
		.run(as_dict=True)
	)
	own_assignments = (
		frappe.qb.from_(Assignment)
		.select(Assignment.name, Assignment.title)
		.where(_isin(Assignment.name, context.assignments))
		.run(as_dict=True)
	)
	return {
		"quizzes": _quiz_rows(quizzes, QuizSubmission, own_quizzes),
		"assignments": _assignment_rows(assignments, AssignmentSubmission, own_assignments),
	}


@frappe.whitelist()
def get_batch_students(
	batch: str,
	stage: str | None = None,
	search: str | None = None,
	start: int = 0,
	page_length: int = 20,
	live_class: str | None = None,
	attendance: str | None = None,
) -> dict:
	"""One page of the batch's students, newest enrollment first.

	`live_class` with `attendance` ("attended" or "missed") narrows the page to the
	students who joined, or did not join, one of the batch's live classes."""
	context = _batch_dashboard_context(batch)
	stage = _validate_stage(stage, BATCH_FILTERS)
	search = _validate_search(search)
	start, page_length = _clamp_page(start, page_length)
	live_class, attendance = _validate_class_filter(context, live_class, attendance)

	query, fields, Enrollment = _batch_students_query(context, stage, search)
	if live_class:
		Participant = frappe.qb.DocType("LMS Live Class Participant")
		joined = (
			frappe.qb.from_(Participant)
			.select(Participant.member)
			.where(Participant.live_class == live_class)
		)
		query = query.where(
			Enrollment.member.isin(joined) if attendance == "attended" else Enrollment.member.notin(joined)
		)
	total = query.select(fn.Count(Enrollment.name)).run()[0][0]
	rows = _newest_first(query.select(*fields), Enrollment).limit(page_length).offset(start).run(as_dict=True)
	progress = _course_progress_by_member(context, [row.member for row in rows])
	certificate_courses = dict(
		frappe.get_all(
			"LMS Certificate",
			{"name": ["in", [row.certificate for row in rows if row.certificate] or [""]]},
			["name", "course"],
			as_list=True,
		)
	)
	return {
		"total": cint(total),
		"rows": [
			{
				**_batch_student_row(row, context, progress),
				"certificate_course": certificate_courses.get(row.certificate),
			}
			for row in rows
		],
	}


@frappe.whitelist(methods=["POST"])
def send_batch_reminder(batch: str, enrollment: str) -> dict:
	"""Email one student of the batch a nudge back to their batch."""
	if not isinstance(batch, str) or not batch:
		frappe.throw(_("Pass the batch name as text."), title=_("Invalid batch"))
	if not can_author_batch(batch):
		frappe.throw(
			_("Only this batch's instructors, evaluators and Moderators can send reminders."),
			frappe.PermissionError,
			title=_("Not permitted"),
		)
	member = _reminder_member(
		"LMS Batch Enrollment", enrollment, "batch", batch, _("This student is not enrolled in this batch.")
	)
	title = frappe.db.get_value("LMS Batch", batch, "title")
	return _send_reminder("LMS Batch Enrollment", enrollment, member, title, f"batches/{batch}", None)


CLASS_ATTENDANCE_FILTERS = ("attended", "missed")


def _validate_class_filter(context: frappe._dict, live_class, attendance) -> tuple[str | None, str | None]:
	if live_class is None or live_class == "":
		return None, None
	if not isinstance(live_class, str) or live_class not in {row.name for row in context.classes}:
		frappe.throw(_("This live class is not part of this batch."), title=_("Invalid live class"))
	if attendance not in CLASS_ATTENDANCE_FILTERS:
		frappe.throw(
			_("Attendance must be one of {0}, got {1}.").format(
				", ".join(CLASS_ATTENDANCE_FILTERS), repr(attendance)
			),
			title=_("Invalid attendance"),
		)
	return live_class, attendance


@frappe.whitelist()
def get_batch_class_attendance(batch: str, live_class: str) -> dict:
	"""Who of the batch's students attended one of its live classes, for how long, and who missed it."""
	context = _batch_dashboard_context(batch)
	if not isinstance(live_class, str) or not live_class:
		frappe.throw(_("Pass the live class name as text."), title=_("Invalid live class"))
	details = next((row for row in context.classes if row.name == live_class), None)
	if not details:
		frappe.throw(_("This live class is not part of this batch."), frappe.DoesNotExistError)

	Enrollment = frappe.qb.DocType("LMS Batch Enrollment")
	Participant = frappe.qb.DocType("LMS Live Class Participant")
	User = frappe.qb.DocType("User")
	member_fields = (
		Enrollment.member,
		fn.Max(fn.Coalesce(User.full_name, Enrollment.member_name)).as_("member_name"),
		fn.Max(fn.Coalesce(User.user_image, Enrollment.member_image)).as_("member_image"),
	)
	attended = (
		frappe.qb.from_(Enrollment)
		.join(Participant)
		.on((Participant.member == Enrollment.member) & (Participant.live_class == live_class))
		.left_join(User)
		.on(User.name == Enrollment.member)
		.select(
			*member_fields,
			fn.Sum(fn.Coalesce(Participant.duration, 0)).as_("duration"),
			fn.Min(Participant.joined_at).as_("joined_at"),
		)
		.where(Enrollment.batch == batch)
		.groupby(Enrollment.member)
		.orderby(Enrollment.member)
		.run(as_dict=True)
	)
	missed = (
		frappe.qb.from_(Enrollment)
		.left_join(Participant)
		.on((Participant.member == Enrollment.member) & (Participant.live_class == live_class))
		.left_join(User)
		.on(User.name == Enrollment.member)
		.select(*member_fields)
		.where((Enrollment.batch == batch) & Participant.name.isnull())
		.groupby(Enrollment.member)
		.orderby(Enrollment.member)
		.run(as_dict=True)
	)
	return {
		"live_class": {key: details[key] for key in ("name", "title", "date", "time", "duration")},
		"attended": [{**row, "duration": cint(row.duration)} for row in attended],
		"missed": missed,
	}


@frappe.whitelist(methods=["GET"])
def export_batch_analytics(
	batch: str, file_format: str = "xlsx", from_date: str | None = None, to_date: str | None = None
) -> None:
	"""The batch's analytics for students who enrolled between the dates, as an Excel or PDF download."""
	context = _batch_dashboard_context(batch)
	file_format = _validate_file_format(file_format)
	window = _validate_time_frame(from_date, to_date)
	send_analytics(_batch_analytics(context, window), file_format)


@frappe.whitelist(methods=["GET"])
def get_batch_analytics_report(batch: str, from_date: str | None = None, to_date: str | None = None) -> str:
	"""The batch's analytics report as HTML, for the browser to draw as an image."""
	context = _batch_dashboard_context(batch)
	window = _validate_time_frame(from_date, to_date)
	return report_html(_batch_analytics(context, window), IMAGE_STUDENTS)


@frappe.whitelist(methods=["GET"])
def get_batch_analytics_preview(
	batch: str, file_format: str = "xlsx", from_date: str | None = None, to_date: str | None = None
) -> dict:
	"""What exporting the batch's analytics in this format would hold, with the students capped."""
	context = _batch_dashboard_context(batch)
	file_format = _validate_file_format(file_format, ANALYTICS_PREVIEW_FORMATS)
	window = _validate_time_frame(from_date, to_date)
	return report_preview(_batch_analytics(context, window), file_format)


def _batch_analytics(context: frappe._dict, window: tuple) -> frappe._dict:
	"""The students who enrolled in the window, their headline numbers, how far they got and
	which classes they joined."""
	query, fields, Enrollment = _batch_students_query(context, None, None)
	query = _enrolled_within(query, Enrollment, window)
	found = _newest_first(query.select(*fields), Enrollment).run(as_dict=True)
	rows = [_batch_student_row(row, context, {}) for row in found]
	enrolled = len(rows)
	courses = len(context.courses)
	state = context.timeline["state"]

	def finished(row):
		return bool(row.certificate) or bool(courses and cint(row.courses_completed) >= courses)

	completed = sum(1 for row in found if finished(row))
	certified = sum(1 for row in found if row.certificate)
	if state == "ended":
		progress_kpis = (
			(_("Completed"), _percent(completed, enrolled), "%"),
			(_("Incomplete"), sum(1 for row in rows if not row["on_track"]), ""),
		)
	else:
		on_track = sum(1 for row in rows if row["on_track"])
		progress_kpis = (
			(_("On track"), None if state == "upcoming" else _percent(on_track, enrolled), "%"),
			(_("At risk"), sum(1 for row in rows if row["at_risk"]), ""),
		)
	track_labels = _batch_track_labels()
	evaluation_labels = _evaluation_labels()
	return _analytics_report(
		kind_label=_("Batch analytics"),
		name=context.name,
		title=frappe.db.get_value("LMS Batch", context.name, "title") or context.name,
		window=window,
		enrolled=enrolled,
		kpis=((_("Students"), enrolled, ""), *progress_kpis, (_("Certified"), certified, "")),
		funnel=(
			(_("Enrolled"), enrolled),
			(_("Started"), sum(1 for row in found if row.certificate or flt(row.progress_total) > 0)),
			(_("Completed"), completed),
			(
				_("Evaluation requested"),
				sum(
					1
					for row in found
					if row.certificate
					or (finished(row) and (row.requested_on or row.scheduled or row.passed or row.failed))
				),
			),
			(_("Certified"), certified),
		),
		classes=_cohort_class_attendance(context, window, enrolled),
		sheet_header=_batch_sheet_header(),
		sheet_rows=[_batch_sheet_row(row) for row in rows],
		table_header=[
			_("Name"),
			_("Email"),
			_("Progress"),
			_("Courses"),
			_("Classes"),
			_("Evaluation"),
			_("Status"),
			_("Last active"),
		],
		table_rows=[
			[
				row["member_name"],
				row["email"],
				f"{flt(row['progress'], 0):g}%",
				f"{row['courses_completed']}/{row['total_courses']}",
				f"{row['attended']}/{row['held']}",
				evaluation_labels[row["evaluation"]["status"]],
				track_labels[row["track"]],
				_report_date(row["last_active"]),
			]
			for row in rows
		],
	)


def _cohort_class_attendance(context: frappe._dict, window: tuple, enrolled: int) -> list[dict]:
	"""How many of the window's students joined each held class."""
	Participant = frappe.qb.DocType("LMS Live Class Participant")
	Enrollment = frappe.qb.DocType("LMS Batch Enrollment")
	query = (
		frappe.qb.from_(Participant)
		.join(Enrollment)
		.on((Enrollment.member == Participant.member) & (Enrollment.batch == context.name))
		.select(Participant.live_class, fn.Count(Participant.member).distinct())
		.where(_isin(Participant.live_class, context.held))
		.groupby(Participant.live_class)
	)
	attended = dict(_enrolled_within(query, Enrollment, window).run())
	return [
		{
			"title": row.title,
			"date": _report_date(row.date),
			"attended": cint(attended.get(row.name)),
			"percent": _percent(attended.get(row.name), enrolled),
		}
		for row in context.classes
		if row.name in context.held
	]


@frappe.whitelist()
def get_batch_student_detail(batch: str, enrollment: str) -> dict:
	"""One student's progress in the batch: courses by chapter, classes, assessments, evaluation,
	recent activity and feedback."""
	context = _batch_dashboard_context(batch)
	if not isinstance(enrollment, str) or not enrollment:
		frappe.throw(_("Pass the enrollment name as text."), title=_("Invalid enrollment"))
	query, fields, Enrollment = _batch_students_query(context, None, None)
	row = query.select(*fields).where(Enrollment.name == enrollment).run(as_dict=True)
	if not row:
		frappe.throw(_("This student is not enrolled in this batch."), frappe.DoesNotExistError)
	row = row[0]
	member = row.member
	student = _batch_student_row(row, context, _course_progress_by_member(context, [member]))
	lessons = _batch_course_lessons(context)
	courses = _student_course_outline(context, member, lessons)
	classes = _student_classes(context, member)
	assessments = _student_assessments(context, member)
	course_assessments = _student_course_assessments(context, lessons, member)
	quiz_attempts = _quiz_attempts(
		[row for row in (*assessments, *course_assessments) if row["type"] == "quiz"], member
	)
	evaluation = _student_evaluation(context.name, member)
	feedback = frappe.db.get_value(
		"LMS Batch Feedback",
		{"batch": context.name, "member": member},
		["content", "instructors", "value", "feedback"],
		as_dict=True,
	)
	return {
		**student,
		"courses": courses,
		"classes": classes,
		"assessments": assessments,
		"course_assessments": course_assessments,
		"evaluation_detail": evaluation,
		"activity": _student_activity(
			student, courses, classes, [*assessments, *course_assessments], quiz_attempts, evaluation
		),
		"feedback": {
			"rating": _average_stars(feedback.content, feedback.instructors, feedback.value),
			"text": feedback.feedback,
		}
		if feedback
		else None,
	}


def _average_stars(*ratings) -> float | None:
	"""Mean of the given 0-1 ratings in stars; a blank (0) rating is left out, as in feedback summaries."""
	rated = [flt(rating) for rating in ratings if flt(rating)]
	return flt(sum(rated) / len(rated) * 5, 1) if rated else None


def _batch_course_lessons(context: frappe._dict) -> list[frappe._dict]:
	"""Every lesson of the batch's courses with its chapter, in course order."""
	ChapterReference = frappe.qb.DocType("Chapter Reference")
	Chapter = frappe.qb.DocType("Course Chapter")
	LessonReference = frappe.qb.DocType("Lesson Reference")
	Lesson = frappe.qb.DocType("Course Lesson")
	return (
		frappe.qb.from_(ChapterReference)
		.join(Chapter)
		.on(Chapter.name == ChapterReference.chapter)
		.join(LessonReference)
		.on(LessonReference.parent == ChapterReference.chapter)
		.left_join(Lesson)
		.on(Lesson.name == LessonReference.lesson)
		.select(
			ChapterReference.parent.as_("course"),
			ChapterReference.chapter,
			Chapter.title.as_("chapter_title"),
			LessonReference.lesson,
			Lesson.title.as_("lesson_title"),
		)
		.where(
			_isin(ChapterReference.parent, context.course_names)
			& (ChapterReference.parenttype == "LMS Course")
		)
		.orderby(ChapterReference.parent, ChapterReference.idx, LessonReference.idx)
		.run(as_dict=True)
	)


def _student_course_outline(context: frappe._dict, member: str, lessons: list[frappe._dict]) -> list[dict]:
	"""Each batch course's chapters with the lessons the member has completed, and the lesson up next."""
	Progress = frappe.qb.DocType("LMS Course Progress")
	Enrollment = frappe.qb.DocType("LMS Enrollment")
	completed = (
		frappe.qb.from_(Progress)
		.select(Progress.course, Progress.lesson, fn.Max(Progress.modified).as_("at"))
		.where(
			(Progress.member == member)
			& (Progress.status == "Complete")
			& _isin(Progress.course, context.course_names)
		)
		.groupby(Progress.course, Progress.lesson)
		.run(as_dict=True)
	)
	done = {(row.course, row.lesson): row.at for row in completed}
	progress = dict(
		frappe.qb.from_(Enrollment)
		.select(Enrollment.course, fn.Max(Enrollment.progress))
		.where((Enrollment.member == member) & _isin(Enrollment.course, context.course_names))
		.groupby(Enrollment.course)
		.run()
	)

	outline = []
	for course in context.courses:
		chapters, up_next = {}, None
		for lesson in (row for row in lessons if row.course == course.course):
			chapter = chapters.setdefault(
				lesson.chapter, {"title": lesson.chapter_title, "lessons": 0, "completed": 0}
			)
			chapter["lessons"] += 1
			if (course.course, lesson.lesson) in done:
				chapter["completed"] += 1
			elif up_next is None:
				up_next = {
					"chapter": lesson.chapter_title,
					"lesson": lesson.lesson_title,
					"number": chapter["lessons"],
					"of": None,
					"chapter_key": lesson.chapter,
				}
		if up_next:
			up_next["of"] = chapters[up_next.pop("chapter_key")]["lessons"]
		finished_at = [at for (c, _lesson), at in done.items() if c == course.course]
		total = sum(chapter["lessons"] for chapter in chapters.values())
		completed_count = sum(chapter["completed"] for chapter in chapters.values())
		outline.append(
			{
				"course": course.course,
				"title": course.title or course.course,
				"progress": flt(progress.get(course.course)),
				"lessons": total,
				"completed": completed_count,
				"up_next": up_next if completed_count else None,
				"finished_at": max(finished_at) if total and completed_count >= total else None,
				"chapters": list(chapters.values()),
			}
		)
	return outline


def _student_classes(context: frappe._dict, member: str) -> list[dict]:
	"""Every batch class, oldest first, as attended, missed or upcoming for the member."""
	Participant = frappe.qb.DocType("LMS Live Class Participant")
	joined = {
		row.live_class: row
		for row in frappe.qb.from_(Participant)
		.select(
			Participant.live_class,
			fn.Sum(fn.Coalesce(Participant.duration, 0)).as_("minutes"),
			fn.Min(Participant.joined_at).as_("joined_at"),
		)
		.where(
			(Participant.member == member)
			& _isin(Participant.live_class, [row.name for row in context.classes])
		)
		.groupby(Participant.live_class)
		.run(as_dict=True)
	}
	classes = []
	for row in context.classes:
		held = row.name in context.held
		attended = joined.get(row.name)
		status = "upcoming" if not held else "attended" if attended else "missed"
		classes.append(
			{
				"name": row.name,
				"title": row.title,
				"date": row.date,
				"time": row.time,
				"status": status,
				"minutes": cint(attended.minutes) if attended else None,
				"joined_at": attended.joined_at if attended else None,
			}
		)
	return classes


def _student_assessments(context: frappe._dict, member: str) -> list[dict]:
	"""The member's best result on each of the batch's quizzes, assignments and exercises."""
	Quiz = frappe.qb.DocType("LMS Quiz")
	QuizSubmission = frappe.qb.DocType("LMS Quiz Submission")
	Assignment = frappe.qb.DocType("LMS Assignment")
	AssignmentSubmission = frappe.qb.DocType("LMS Assignment Submission")
	Exercise = frappe.qb.DocType("LMS Programming Exercise")
	ExerciseSubmission = frappe.qb.DocType("LMS Programming Exercise Submission")
	quizzes = (
		frappe.qb.from_(Quiz)
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
		.where(_isin(Quiz.name, context.quizzes))
		.groupby(Quiz.name, Quiz.title)
		.run(as_dict=True)
	)
	assignments = (
		frappe.qb.from_(Assignment)
		.left_join(AssignmentSubmission)
		.on((AssignmentSubmission.assignment == Assignment.name) & (AssignmentSubmission.member == member))
		.select(
			Assignment.name,
			Assignment.title,
			AssignmentSubmission.status,
			AssignmentSubmission.creation.as_("at"),
		)
		.where(_isin(Assignment.name, context.assignments))
		.orderby(AssignmentSubmission.creation, order=Order.desc)
		.run(as_dict=True)
	)
	exercises = (
		frappe.qb.from_(Exercise)
		.left_join(ExerciseSubmission)
		.on((ExerciseSubmission.exercise == Exercise.name) & (ExerciseSubmission.member == member))
		.select(
			Exercise.name, Exercise.title, ExerciseSubmission.status, ExerciseSubmission.creation.as_("at")
		)
		.where(_isin(Exercise.name, context.exercises))
		.orderby(ExerciseSubmission.creation, order=Order.desc)
		.run(as_dict=True)
	)

	rows = []
	for quiz in quizzes:
		attempted = cint(quiz.attempts) > 0
		rows.append(
			{
				"type": "quiz",
				"name": quiz.name,
				"title": quiz.title or quiz.name,
				"status": ("passed" if quiz.passed else "failed") if attempted else "not_attempted",
				"score": flt(quiz.score, 1) if attempted else None,
				"at": quiz.at,
			}
		)
	statuses = {
		"Pass": "passed",
		"Fail": "failed",
		"Not Graded": "to_review",
		"Passed": "passed",
		"Failed": "failed",
	}
	for kind, items in (("assignment", assignments), ("exercise", exercises)):
		seen = set()
		for item in items:
			if item.name in seen:
				continue
			seen.add(item.name)
			rows.append(
				{
					"type": kind,
					"name": item.name,
					"title": item.title or item.name,
					"status": statuses.get(item.status, "not_attempted") if item.at else "not_attempted",
					"score": None,
					"at": item.at,
				}
			)
	return rows


def _student_course_assessments(
	context: frappe._dict, lessons: list[frappe._dict], member: str
) -> list[dict]:
	"""The member's result on each quiz, assignment and exercise in the batch's course lessons, once
	each and in course order, leaving out those the batch assesses itself."""
	results = _lesson_assessment_results([lesson.lesson for lesson in lessons], member)
	seen = {("quiz", name) for name in context.quizzes}
	seen.update(("assignment", name) for name in context.assignments)
	seen.update(("exercise", name) for name in context.exercises)
	rows = []
	for course in context.courses:
		for lesson in lessons:
			if lesson.course != course.course:
				continue
			for result in results.get(lesson.lesson, []):
				key = (result["type"], result["name"])
				if key in seen:
					continue
				seen.add(key)
				rows.append(
					{**result, "course": course.course, "course_title": course.title or course.course}
				)
	return rows


def _student_evaluation(batch: str, member: str) -> dict:
	"""The member's latest evaluation request, evaluation and certificate in the batch."""
	request = frappe.db.get_value(
		"LMS Certificate Request",
		{"batch_name": batch, "member": member, "status": ["!=", "Cancelled"]},
		["date", "start_time", "status", "evaluator_name", "course_title", "creation"],
		as_dict=True,
		order_by="date desc",
	)
	result = frappe.db.get_value(
		"LMS Certificate Evaluation",
		{"batch_name": batch, "member": member, "status": ["in", ["Pass", "Fail"]]},
		["status", "date", "evaluator_name"],
		as_dict=True,
		order_by="date desc",
	)
	certificate = frappe.db.get_value(
		"LMS Certificate",
		{"batch_name": batch, "member": member},
		["name", "course", "issue_date"],
		as_dict=True,
		order_by="issue_date desc",
	)
	return {"request": request, "result": result, "certificate": certificate}


ACTIVITY_LIMIT = 10


def _student_activity(student, courses, classes, assessments, quiz_attempts, evaluation) -> list[dict]:
	"""The member's latest events in the batch, each quiz attempt among them, newest first, ending
	with when they joined."""
	events = [
		{"kind": cls["status"], "title": cls["title"], "at": cls["joined_at"] or get_datetime(cls["date"])}
		for cls in classes
		if cls["status"] != "upcoming"
	]
	events += [
		{
			"kind": f"{row['type']}_{row['status']}",
			"title": row["title"],
			"score": row["score"],
			"at": row["at"],
		}
		for row in assessments
		if row["type"] != "quiz" and row["at"]
	]
	events += quiz_attempts
	events += [
		{"kind": "course_completed", "title": course["title"], "at": course["finished_at"]}
		for course in courses
		if course["finished_at"]
	]
	if evaluation["request"]:
		events.append(
			{
				"kind": "evaluation_requested",
				"title": evaluation["request"].course_title,
				"date": evaluation["request"].date,
				"at": evaluation["request"].creation,
			}
		)
	if evaluation["result"]:
		events.append(
			{
				"kind": f"evaluation_{evaluation['result'].status.lower()}",
				"title": None,
				"at": get_datetime(evaluation["result"].date),
			}
		)
	if evaluation["certificate"] and evaluation["certificate"].issue_date:
		events.append(
			{
				"kind": "certified",
				"title": evaluation["certificate"].name,
				"at": get_datetime(evaluation["certificate"].issue_date),
			}
		)
	events = sorted(
		(event for event in events if event["at"]), key=lambda event: get_datetime(event["at"]), reverse=True
	)
	return [*events[:ACTIVITY_LIMIT], {"kind": "joined", "title": None, "at": student["enrolled_on"]}]


def _batch_dashboard_context(batch) -> frappe._dict:
	"""The batch's dates, courses, assessments and live classes, once access is checked."""
	_check_batch_dashboard_access(batch)
	context = frappe.db.get_value(
		"LMS Batch",
		batch,
		["name", "start_date", "end_date", "evaluation_end_date", "seat_count", "paid_batch", "timezone"],
		as_dict=True,
	)
	BatchCourse = frappe.qb.DocType("Batch Course")
	Assessment = frappe.qb.DocType("LMS Assessment")
	LiveClass = frappe.qb.DocType("LMS Live Class")
	context.courses = (
		frappe.qb.from_(BatchCourse)
		.select(BatchCourse.course, BatchCourse.title)
		.where((BatchCourse.parent == batch) & (BatchCourse.parenttype == "LMS Batch"))
		.orderby(BatchCourse.idx)
		.run(as_dict=True)
	)
	context.assessments = (
		frappe.qb.from_(Assessment)
		.select(Assessment.assessment_type, Assessment.assessment_name)
		.where((Assessment.parent == batch) & (Assessment.parenttype == "LMS Batch"))
		.run(as_dict=True)
	)
	context.classes = (
		frappe.qb.from_(LiveClass)
		.select(
			LiveClass.name,
			LiveClass.title,
			LiveClass.date,
			LiveClass.time,
			LiveClass.duration,
			LiveClass.timezone,
			LiveClass.host,
			LiveClass.join_url,
		)
		.where(LiveClass.batch_name == batch)
		.orderby(LiveClass.date)
		.orderby(LiveClass.time)
		.run(as_dict=True)
	)

	def of_type(doctype):
		return [row.assessment_name for row in context.assessments if row.assessment_type == doctype]

	context.course_names = [row.course for row in context.courses]
	context.quizzes = of_type("LMS Quiz")
	context.assignments = of_type("LMS Assignment")
	context.exercises = of_type("LMS Programming Exercise")
	context.now = now_datetime()
	today = getdate(context.now)
	start = getdate(context.start_date or today)
	end = max(getdate(context.end_date or start), start)
	context.timeline = _batch_timeline(start, end, today)
	context.timeline.update(
		{"start_date": start, "end_date": end, "evaluation_end_date": context.evaluation_end_date}
	)
	context.expected = _elapsed_share(start, end, today) * 100
	context.held = [row.name for row in context.classes if _class_has_ended(row, context.timezone)]
	return context


def _check_batch_dashboard_access(batch) -> None:
	if not isinstance(batch, str) or not batch:
		frappe.throw(_("Pass the batch name as text."), title=_("Invalid batch"))
	if not (evaluator_role_reads_batch(batch) or can_author_batch(batch)):
		frappe.throw(
			_("Only this batch's instructors, evaluators and Moderators can see its dashboard."),
			frappe.PermissionError,
			title=_("Not permitted"),
		)
	if not frappe.db.exists("LMS Batch", batch):
		frappe.throw(_("Batch {0} does not exist.").format(batch), frappe.DoesNotExistError)


def _elapsed_share(start, end, today) -> float:
	"""How much of the batch has gone by, from 0 before it starts to 1 once it ends."""
	days = (end - start).days + 1
	return min(max((today - start).days / days, 0), 1)


def _batch_timeline(start, end, today) -> dict:
	days = (end - start).days + 1
	weeks = -(-days // 7)
	timeline = {
		"state": "live",
		"days": days,
		"day": (today - start).days + 1,
		"weeks": weeks,
		"week": 0,
		"elapsed": flt(_elapsed_share(start, end, today) * 100, 1),
		"days_to_start": None,
		"days_since_end": None,
	}
	if today < start:
		timeline.update(state="upcoming", day=0, days_to_start=(start - today).days)
	elif today > end:
		timeline.update(state="ended", day=days, week=weeks, days_since_end=(today - end).days)
	else:
		timeline["week"] = (timeline["day"] - 1) // 7 + 1
	return timeline


def _class_has_ended(live_class: frappe._dict, batch_timezone: str | None) -> bool:
	"""A class is held once its scheduled end has passed, in the class's own time zone."""
	if not live_class.date:
		return False
	starts = datetime.combine(getdate(live_class.date), get_time(live_class.time or "00:00:00"))
	ends = starts + timedelta(minutes=cint(live_class.duration))
	return ends <= _now_in(live_class.timezone or batch_timezone)


def _now_in(timezone: str | None) -> datetime:
	try:
		zone = ZoneInfo(timezone or get_system_timezone())
	except (ValueError, ZoneInfoNotFoundError):
		zone = ZoneInfo(get_system_timezone())
	return datetime.now(zone).replace(tzinfo=None)


def _isin(field, values: list):
	"""`field IN values`, which for no values matches nothing rather than being invalid SQL."""
	return field.isin(values) if values else field.isnull() & field.isnotnull()


def _batch_roster(batch: str):
	Roster = frappe.qb.DocType("LMS Batch Enrollment").as_("roster")
	return frappe.qb.from_(Roster).select(Roster.member).where(Roster.batch == batch)


def _batch_members_only(query, Submission, batch: str):
	Enrollment = frappe.qb.DocType("LMS Batch Enrollment")
	return query.join(Enrollment).on((Enrollment.member == Submission.member) & (Enrollment.batch == batch))


def _batch_member_facts(context: frappe._dict):
	"""The batch's enrollments joined to each member's course progress, attendance, assessments,
	evaluation and last activity, with the conditions the filters are built from."""
	Enrollment = frappe.qb.DocType("LMS Batch Enrollment")
	roster = _batch_roster(context.name)
	progress = _member_course_progress(context, roster)
	attendance = _member_attendance(context, roster)
	certificates = _member_certificates(context.name)
	evaluations = _member_evaluations(context.name)
	requests = _member_requests(context.name, getdate(context.now))
	activity = _member_activity(context, roster)
	passes = _member_passes(context, roster)

	query = frappe.qb.from_(Enrollment)
	for subquery in (progress, attendance, certificates, evaluations, requests, activity, passes):
		query = query.left_join(subquery).on(subquery.member == Enrollment.member)
	query = query.where(Enrollment.batch == context.name)

	courses = len(context.courses)
	never, always = Enrollment.name.isnull(), Enrollment.name.isnotnull()
	cutoff = add_days(context.now, -INACTIVE_AFTER_DAYS)
	progress_total = fn.Coalesce(progress.progress_total, 0)
	courses_completed = fn.Coalesce(progress.courses_completed, 0)
	attended = fn.Coalesce(attendance.attended, 0)
	# Idle for two weeks counts once the batch and the student's enrollment are both that old.
	inactive = never
	if getdate(context.timeline["start_date"]) <= getdate(cutoff):
		inactive = (Enrollment.creation < cutoff) & (
			activity.last_active.isnull() | (activity.last_active < cutoff)
		)

	facts = frappe._dict(
		enrollment=Enrollment,
		progress_total=progress_total,
		courses_completed=courses_completed,
		attended=attended,
		assessments_passed=fn.Coalesce(passes.assessments_passed, 0),
		certificate=certificates.certificate,
		evaluation_passed=fn.Coalesce(evaluations.evaluation_passed, 0),
		evaluation_failed=fn.Coalesce(evaluations.evaluation_failed, 0),
		evaluated=evaluations.member,
		requested_on=requests.requested_on,
		scheduled_on=requests.scheduled_on,
		last_active=activity.last_active,
		finished=(courses_completed >= courses) if courses else never,
		# Average progress across the courses at least the share of the batch gone by.
		on_schedule=(progress_total >= context.expected * courses) if courses else always,
		low_attendance=(attended * 2 < len(context.held)) if context.held else never,
		inactive=inactive,
	)
	return query, facts


def _batch_filter_condition(key: str, facts: frappe._dict):
	"""The SQL condition for one of BATCH_FILTERS. The funnel steps nest: each holds only
	students who also reached the step before it."""
	certified = facts.certificate.isnotnull()
	if key == "certified":
		return certified
	finished = certified | facts.finished
	if key == "completed":
		return finished
	started = certified | (facts.progress_total > 0)
	if key == "started":
		return started
	if key == "not_started":
		return started.negate()
	if key == "evaluation_requested":
		return certified | (facts.finished & (facts.requested_on.isnotnull() | facts.evaluated.isnotnull()))
	if key == "no_evaluation":
		return certified.negate() & facts.finished & facts.requested_on.isnull() & facts.evaluated.isnull()
	on_track = finished | facts.on_schedule
	if key == "on_track":
		return on_track
	if key == "behind":
		return on_track.negate()
	return finished.negate() & (facts.low_attendance | facts.inactive)


def _evaluation_conditions(facts: frappe._dict) -> dict:
	passed = facts.certificate.isnotnull() | (facts.evaluation_passed == 1)
	scheduled = facts.scheduled_on.isnotnull() & passed.negate()
	failed = (facts.evaluation_failed == 1) & passed.negate() & facts.scheduled_on.isnull()
	return {"passed": passed, "scheduled": scheduled, "failed": failed}


def _batch_summary(context: frappe._dict) -> frappe._dict:
	query, facts = _batch_member_facts(context)
	enrolled_on = facts.enrollment.creation
	window_start = _month_ago(context.now)
	previous_window_start = add_days(context.now, -2 * DELTA_WINDOW_DAYS)
	return query.select(
		fn.Count(facts.enrollment.name).as_("enrolled"),
		*(_count_where(_batch_filter_condition(key, facts)).as_(key) for key in BATCH_FILTERS),
		*(_count_where(condition).as_(key) for key, condition in _evaluation_conditions(facts).items()),
		_count_where(enrolled_on >= window_start).as_("enrolled_last_window"),
		_count_where((enrolled_on >= previous_window_start) & (enrolled_on < window_start)).as_(
			"enrolled_previous_window"
		),
	).run(as_dict=True)[0]


def _member_course_progress(context: frappe._dict, roster):
	Enrollment = frappe.qb.DocType("LMS Enrollment")
	per_course = (
		frappe.qb.from_(Enrollment)
		.select(Enrollment.member, fn.Max(fn.Coalesce(Enrollment.progress, 0)).as_("progress"))
		.where(_isin(Enrollment.course, context.course_names) & Enrollment.member.isin(roster))
		.groupby(Enrollment.member, Enrollment.course)
		.as_("per_course")
	)
	return (
		frappe.qb.from_(per_course)
		.select(
			per_course.member,
			fn.Sum(per_course.progress).as_("progress_total"),
			_count_where(per_course.progress >= 100).as_("courses_completed"),
		)
		.groupby(per_course.member)
		.as_("progress")
	)


def _member_attendance(context: frappe._dict, roster):
	Participant = frappe.qb.DocType("LMS Live Class Participant")
	return (
		frappe.qb.from_(Participant)
		.select(Participant.member, fn.Count(Participant.live_class).distinct().as_("attended"))
		.where(_isin(Participant.live_class, context.held) & Participant.member.isin(roster))
		.groupby(Participant.member)
		.as_("attendance")
	)


def _member_certificates(batch: str):
	Certificate = frappe.qb.DocType("LMS Certificate")
	return (
		frappe.qb.from_(Certificate)
		.select(Certificate.member, fn.Max(Certificate.name).as_("certificate"))
		.where(Certificate.batch_name == batch)
		.groupby(Certificate.member)
		.as_("certificates")
	)


def _member_evaluations(batch: str):
	Evaluation = frappe.qb.DocType("LMS Certificate Evaluation")

	def any_with(status):
		return fn.Max(Case().when(Evaluation.status == status, 1).else_(0))

	return (
		frappe.qb.from_(Evaluation)
		.select(
			Evaluation.member,
			any_with("Pass").as_("evaluation_passed"),
			any_with("Fail").as_("evaluation_failed"),
		)
		.where(Evaluation.batch_name == batch)
		.groupby(Evaluation.member)
		.as_("evaluations")
	)


def _member_requests(batch: str, today):
	Request = frappe.qb.DocType("LMS Certificate Request")
	upcoming = (Request.status == "Upcoming") & (Request.date >= today)
	return (
		frappe.qb.from_(Request)
		.select(
			Request.member,
			fn.Max(Request.date).as_("requested_on"),
			fn.Min(Case().when(upcoming, Request.date)).as_("scheduled_on"),
		)
		.where((Request.batch_name == batch) & (Request.status != "Cancelled"))
		.groupby(Request.member)
		.as_("requests")
	)


def _member_activity(context: frappe._dict, roster):
	"""Each member's latest lesson visit, quiz, assignment or exercise in the batch, or class joined."""
	Progress = frappe.qb.DocType("LMS Course Progress")
	Quiz = frappe.qb.DocType("LMS Quiz Submission")
	Assignment = frappe.qb.DocType("LMS Assignment Submission")
	Exercise = frappe.qb.DocType("LMS Programming Exercise Submission")
	Participant = frappe.qb.DocType("LMS Live Class Participant")
	courses = context.course_names
	parts = (
		(Progress, Progress.modified, _isin(Progress.course, courses)),
		(Quiz, Quiz.creation, _isin(Quiz.quiz, context.quizzes) | _isin(Quiz.course, courses)),
		(
			Assignment,
			Assignment.creation,
			_isin(Assignment.assignment, context.assignments) | _isin(Assignment.course, courses),
		),
		(Exercise, Exercise.creation, _isin(Exercise.exercise, context.exercises)),
		(
			Participant,
			fn.Coalesce(Participant.joined_at, Participant.creation),
			_isin(Participant.live_class, [row.name for row in context.classes]),
		),
	)
	events = None
	for table, at, condition in parts:
		part = (
			frappe.qb.from_(table)
			.select(table.member, at.as_("at"))
			.where(condition & table.member.isin(roster))
		)
		events = part if events is None else events.union_all(part)
	events = events.as_("events")
	return (
		frappe.qb.from_(events)
		.select(events.member, fn.Max(events.at).as_("last_active"))
		.groupby(events.member)
		.as_("activity")
	)


def _member_passes(context: frappe._dict, roster):
	"""How many of the batch's assessments each member has passed."""
	Quiz = frappe.qb.DocType("LMS Quiz Submission")
	Assignment = frappe.qb.DocType("LMS Assignment Submission")
	Exercise = frappe.qb.DocType("LMS Programming Exercise Submission")
	quiz_passed = fn.Coalesce(Quiz.percentage, 0) >= fn.Coalesce(Quiz.passing_percentage, 0)
	parts = (
		(Quiz, Quiz.quiz, _isin(Quiz.quiz, context.quizzes) & quiz_passed),
		(
			Assignment,
			Assignment.assignment,
			_isin(Assignment.assignment, context.assignments) & (Assignment.status == "Pass"),
		),
		(
			Exercise,
			Exercise.exercise,
			_isin(Exercise.exercise, context.exercises) & (Exercise.status == "Passed"),
		),
	)
	passed = None
	for table, assessment, condition in parts:
		part = (
			frappe.qb.from_(table)
			.select(table.member, assessment.as_("assessment"))
			.where(condition & table.member.isin(roster))
		)
		passed = part if passed is None else passed.union_all(part)
	passed = passed.as_("passed")
	return (
		frappe.qb.from_(passed)
		.select(passed.member, fn.Count(passed.assessment).distinct().as_("assessments_passed"))
		.groupby(passed.member)
		.as_("passes")
	)


def _batch_students_query(context: frappe._dict, stage: str | None, search: str | None):
	"""The batch's students query with no select list, its row fields, and the enrollment table."""
	query, facts = _batch_member_facts(context)
	Enrollment = facts.enrollment
	User = frappe.qb.DocType("User")
	Payment = frappe.qb.DocType("LMS Payment")
	query = (
		query.left_join(User)
		.on(User.name == Enrollment.member)
		.left_join(Payment)
		.on(Payment.name == Enrollment.payment)
	)
	if stage:
		query = query.where(_batch_filter_condition(stage, facts))
	if search:
		pattern = f"%{_escape_like(search)}%"
		query = query.where(
			User.full_name.like(pattern)
			| User.email.like(pattern)
			| Enrollment.member.like(pattern)
			| Enrollment.member_name.like(pattern)
		)

	evaluation = _evaluation_conditions(facts)
	fields = (
		Enrollment.name.as_("enrollment"),
		Enrollment.member,
		fn.Coalesce(User.full_name, Enrollment.member_name).as_("member_name"),
		fn.Coalesce(User.user_image, Enrollment.member_image).as_("member_image"),
		User.email,
		facts.progress_total.as_("progress_total"),
		facts.courses_completed.as_("courses_completed"),
		facts.attended.as_("attended"),
		facts.assessments_passed.as_("assessments_passed"),
		facts.last_active.as_("last_active"),
		facts.certificate.as_("certificate"),
		facts.scheduled_on.as_("scheduled_on"),
		facts.requested_on.as_("requested_on"),
		*(Case().when(condition, 1).else_(0).as_(key) for key, condition in evaluation.items()),
		Case().when(_batch_filter_condition("on_track", facts), 1).else_(0).as_("on_track"),
		Case().when(_batch_filter_condition("at_risk", facts), 1).else_(0).as_("at_risk"),
		Payment.name.as_("payment"),
		Payment.payment_received,
		Payment.amount,
		Payment.currency,
		Enrollment.creation.as_("enrolled_on"),
	)
	return query, fields, Enrollment


def _course_progress_by_member(context: frappe._dict, members: list[str]) -> dict:
	Enrollment = frappe.qb.DocType("LMS Enrollment")
	rows = (
		frappe.qb.from_(Enrollment)
		.select(Enrollment.member, Enrollment.course, fn.Max(Enrollment.progress).as_("progress"))
		.where(_isin(Enrollment.course, context.course_names) & _isin(Enrollment.member, members))
		.groupby(Enrollment.member, Enrollment.course)
		.run(as_dict=True)
	)
	return {(row.member, row.course): flt(row.progress) for row in rows}


def _evaluation_status(row: frappe._dict) -> dict:
	if row.passed:
		return {"status": "passed", "date": None}
	if row.scheduled:
		return {"status": "scheduled", "date": row.scheduled_on}
	if row.failed:
		return {"status": "failed", "date": None}
	if row.requested_on:
		return {"status": "scheduled", "date": row.requested_on}
	return {"status": "not_requested", "date": None}


def _track(row: frappe._dict, courses: int) -> str:
	"""The one word the list and the student view describe a student by."""
	if row.certificate or (courses and cint(row.courses_completed) >= courses):
		return "completed"
	if row.at_risk:
		return "at_risk"
	if not flt(row.progress_total):
		return "not_started"
	return "on_track" if row.on_track else "behind"


def _batch_student_row(row: frappe._dict, context: frappe._dict, progress: dict) -> dict:
	courses = len(context.courses)
	has_payment = bool(row.payment)
	return {
		"enrollment": row.enrollment,
		"member": row.member,
		"member_name": row.member_name,
		"member_image": row.member_image,
		"email": row.email,
		"progress": flt(flt(row.progress_total) / courses, 1) if courses else 0.0,
		"courses": [
			{
				"course": course.course,
				"title": course.title or course.course,
				"progress": progress.get((row.member, course.course), 0.0),
			}
			for course in context.courses
		],
		"courses_completed": cint(row.courses_completed),
		"total_courses": courses,
		"attended": cint(row.attended),
		"held": len(context.held),
		"assessments_passed": cint(row.assessments_passed),
		"total_assessments": len(context.assessments),
		"evaluation": _evaluation_status(row),
		"certificate": row.certificate,
		"on_track": bool(row.on_track),
		"at_risk": bool(row.at_risk),
		"track": _track(row, courses),
		"payment_status": _payment_status(row),
		"amount": flt(row.amount) if has_payment else None,
		"currency": row.currency if has_payment else None,
		"last_active": row.last_active,
		"enrolled_on": row.enrolled_on,
	}


def _batch_attendance(context: frappe._dict, enrolled: int) -> dict:
	"""Attendance of the batch's students at each held class, overall, and over the last two months."""
	Participant = frappe.qb.DocType("LMS Live Class Participant")
	attended = dict(
		_batch_members_only(frappe.qb.from_(Participant), Participant, context.name)
		.select(Participant.live_class, fn.Count(Participant.member).distinct())
		.where(_isin(Participant.live_class, context.held))
		.groupby(Participant.live_class)
		.run()
	)
	held = [row for row in context.classes if row.name in context.held]
	classes = [
		{
			"name": row.name,
			"title": row.title,
			"date": row.date,
			"time": row.time,
			"duration": cint(row.duration),
			"attended": cint(attended.get(row.name)),
			"rate": _percent(attended.get(row.name), enrolled),
		}
		for row in held
	]

	def rate_of(rows):
		return _percent(sum(row["attended"] for row in rows), enrolled * len(rows)) if rows else None

	today = getdate(context.now)
	window_start = add_days(today, -DELTA_WINDOW_DAYS)
	previous_start = add_days(today, -2 * DELTA_WINDOW_DAYS)
	return {
		"summary": {
			"held": len(held),
			"upcoming": len(context.classes) - len(held),
			"attended": sum(row["attended"] for row in classes),
			"rate": rate_of(classes),
			"classes": classes,
			"upcoming_classes": [
				{key: row[key] for key in ("name", "title", "date", "time")}
				for row in context.classes
				if row.name not in context.held
			],
		},
		"windows": {
			"current": rate_of([row for row in classes if getdate(row["date"]) >= window_start]),
			"previous": rate_of(
				[row for row in classes if previous_start <= getdate(row["date"]) < window_start]
			),
		},
	}


def _batch_review_backlog(context: frappe._dict, checkpoints: list) -> list[int]:
	"""Submissions of the batch's students to its assignments waiting for a grade at each checkpoint."""
	Submission = frappe.qb.DocType("LMS Assignment Submission")
	query = _batch_members_only(frappe.qb.from_(Submission), Submission, context.name).where(
		_isin(Submission.assignment, context.assignments)
	)
	return _review_backlog_counts(query, Submission, checkpoints)


def _batch_course_progress(context: frappe._dict, enrolled: int) -> list[dict]:
	"""Each batch course's average progress across the batch's students, and how many finished it."""
	Enrollment = frappe.qb.DocType("LMS Enrollment")
	per_member = (
		_batch_members_only(frappe.qb.from_(Enrollment), Enrollment, context.name)
		.select(
			Enrollment.course,
			Enrollment.member,
			fn.Max(fn.Coalesce(Enrollment.progress, 0)).as_("progress"),
		)
		.where(_isin(Enrollment.course, context.course_names))
		.groupby(Enrollment.course, Enrollment.member)
		.as_("per_member")
	)
	totals = {
		row.course: row
		for row in frappe.qb.from_(per_member)
		.select(
			per_member.course,
			fn.Sum(per_member.progress).as_("progress"),
			_count_where(per_member.progress >= 100).as_("completed"),
		)
		.groupby(per_member.course)
		.run(as_dict=True)
	}
	return [
		{
			"course": course.course,
			"title": course.title or course.course,
			"average_progress": flt(flt(totals[course.course].progress) / enrolled, 1)
			if enrolled and course.course in totals
			else 0.0,
			"completed": cint(totals[course.course].completed) if course.course in totals else 0,
		}
		for course in context.courses
	]


def _batch_agenda(context: frappe._dict) -> dict:
	"""The next live classes and this week's evaluations."""
	upcoming = [row for row in context.classes if row.name not in context.held][:AGENDA_CLASSES]
	hosts = {row.host for row in upcoming if row.host}
	host_names = dict(
		frappe.get_all("User", {"name": ["in", list(hosts)]}, ["name", "full_name"], as_list=True)
	)
	Request = frappe.qb.DocType("LMS Certificate Request")
	User = frappe.qb.DocType("User")
	today = getdate(context.now)
	this_week = (
		(Request.batch_name == context.name)
		& (Request.status == "Upcoming")
		& (Request.date >= today)
		& (Request.date < add_days(today, AGENDA_DAYS))
	)
	evaluations = (
		frappe.qb.from_(Request)
		.left_join(User)
		.on(User.name == Request.member)
		.select(
			Request.name,
			Request.member,
			fn.Coalesce(User.full_name, Request.member_name).as_("member_name"),
			User.user_image.as_("member_image"),
			Request.course_title,
			Request.date,
			Request.start_time,
		)
		.where(this_week)
		.orderby(Request.date)
		.orderby(Request.start_time)
		.limit(AGENDA_EVALUATIONS)
		.run(as_dict=True)
	)
	total = frappe.qb.from_(Request).select(fn.Count(Request.name)).where(this_week).run()[0][0]
	return {
		"classes": [
			{
				**{key: row[key] for key in ("name", "title", "date", "time", "join_url", "host")},
				"duration": cint(row.duration),
				"timezone": row.timezone or context.timezone,
				"host_name": host_names.get(row.host),
			}
			for row in upcoming
		],
		"evaluations": evaluations,
		"evaluations_total": cint(total),
	}


def _batch_sheet_header() -> list[str]:
	return [
		_("Name"),
		_("Email"),
		_("Progress (%)"),
		_("Courses completed"),
		_("Total courses"),
		_("On track"),
		_("At risk"),
		_("Classes attended"),
		_("Classes held"),
		_("Assessments passed"),
		_("Total assessments"),
		_("Evaluation"),
		_("Payment status"),
		_("Amount"),
		_("Currency"),
		_("Last active"),
		_("Enrolled on"),
		_("Certificate"),
	]


def _evaluation_labels() -> dict:
	return {
		"not_requested": _("Not requested"),
		"scheduled": _("Scheduled"),
		"passed": _("Passed"),
		"failed": _("Failed"),
	}


def _batch_track_labels() -> dict:
	return {
		"completed": _("Completed"),
		"at_risk": _("At risk"),
		"not_started": _("Not started"),
		"on_track": _("On track"),
		"behind": _("Behind"),
	}


def _batch_sheet_row(row: dict) -> list:
	return [
		row["member_name"],
		row["email"],
		row["progress"],
		row["courses_completed"],
		row["total_courses"],
		_("Yes") if row["on_track"] else _("No"),
		_("Yes") if row["at_risk"] else _("No"),
		row["attended"],
		row["held"],
		row["assessments_passed"],
		row["total_assessments"],
		_evaluation_labels()[row["evaluation"]["status"]],
		_payment_labels()[row["payment_status"]],
		row["amount"],
		row["currency"],
		_sheet_datetime(row["last_active"]),
		_sheet_datetime(row["enrolled_on"]),
		row["certificate"],
	]
