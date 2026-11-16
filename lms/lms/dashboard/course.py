# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""The course dashboard's endpoints: stats, students, a student's progress, reviews, reminders, certificates and analytics."""

from datetime import timedelta

import frappe
from frappe import _
from frappe.query_builder import Case
from frappe.utils import (
	add_days,
	cint,
	flt,
	get_datetime,
	getdate,
	now_datetime,
	nowdate,
)
from pypika import functions as fn
from pypika.terms import ValueWrapper

from lms.lms.analytics_report import IMAGE_STUDENTS, report_html, report_preview, send_analytics
from lms.lms.dashboard.common import (
	ANALYTICS_PREVIEW_FORMATS,
	DASHBOARD_STAGES,
	DELTA_WINDOW_DAYS,
	INACTIVE_AFTER_DAYS,
	STUDENT_FILTERS,
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
	_weekly_values,
	_windowed_counts,
)
from lms.lms.doctype.lms_certificate.lms_certificate import (
	get_default_certificate_template,
	get_enrollment_batch,
	get_latest_certificate,
)
from lms.lms.doctype.lms_course_review.lms_course_review import course_review_rows, course_review_summary
from lms.lms.feedback import validate_feedback_page
from lms.lms.utils import (
	can_modify_course,
)

ACTIVE_WINDOW_DAYS = 7


@frappe.whitelist()
def get_course_dashboard_stats(course: str) -> dict:
	"""Enrollment, stage, funnel, activity and content counts for the course dashboard."""
	_check_dashboard_access(course)

	lessons = _course_lesson_names(course)
	now = now_datetime()
	weeks = _trend_weeks(now)
	# The end of each trend week (this week's is now), then the same moment a month ago.
	checkpoints = [
		*(min(get_datetime(str(week + timedelta(weeks=1))), now) for week in weeks),
		_month_ago(now),
	]
	summary = _enrollment_summary(course, lessons, now, checkpoints)
	stages = {stage: cint(summary[stage]) for stage in DASHBOARD_STAGES}
	enrolled = cint(summary.enrolled)
	rating_trends = _course_rating_trends(course, now)
	backlog = _review_backlog(course, [*checkpoints, now])
	completion = [
		_percent(summary[f"finished_by_{index}"], summary[f"enrolled_by_{index}"])
		for index in range(len(checkpoints))
	]
	weekly = _weekly_trends(course, lessons, weeks)
	active_windows = weekly.pop("active_windows")
	certificate_windows = weekly.pop("certificate_windows")

	return {
		"enrolled": enrolled,
		"started": cint(summary.started),
		"completed": cint(summary.finished),
		"certified": stages["certified"],
		"completed_not_certified": stages["completed"],
		"inactive": cint(summary.inactive),
		"active_7d": cint(summary.active_7d),
		"awaiting_review": backlog[-1],
		"total_lessons": len(lessons),
		"chapters": frappe.db.count("Chapter Reference", {"parent": course, "parenttype": "LMS Course"}),
		"feedback": course_review_summary(course),
		"stages": stages,
		"funnel": {
			"enrolled": enrolled,
			"started": cint(summary.started),
			"halfway": cint(summary.halfway),
			"finished": cint(summary.finished),
			"evaluation_requested": cint(summary.evaluation_requested),
			"certified": stages["certified"],
		},
		# Certification by evaluation adds the request step between finishing and
		# the certificate; a course without it issues the certificate on finishing.
		"has_evaluation": _course_has_evaluation(course),
		"deltas": {
			"enrollments": {
				"current": cint(summary.enrolled_last_window),
				"previous": cint(summary.enrolled_previous_window),
			},
			"active": active_windows,
			"certificates": certificate_windows,
			"awaiting_review": {"current": backlog[-1], "previous": backlog[-2]},
			"completion_rate": {"current": _percent(summary.finished, enrolled), "previous": completion[-1]},
			"rating": {
				"current": rating_trends["last_window"],
				"previous": rating_trends["previous_window"],
			},
		},
		"weekly": {
			**weekly,
			"completion_rate": completion[:-1],
			"awaiting_review": backlog[:-2],
			"rating": rating_trends["weekly"],
		},
	}


@frappe.whitelist(methods=["GET"])
def get_course_review_list(
	course: str, low_only: bool = False, start: int = 0, page_length: int = 20
) -> list:
	"""A page of a course's reviews, newest first. `page_length=0` returns every row."""
	validate_feedback_page(low_only, start, page_length)
	_check_dashboard_access(course)
	return course_review_rows(course, low_only=low_only, start=start, page_length=page_length)


@frappe.whitelist()
def get_course_assessment_stats(course: str) -> dict:
	"""Attempts and results of the course's quizzes and assignments, by its enrolled students."""
	_check_dashboard_access(course)
	return {"quizzes": _quiz_stats(course), "assignments": _assignment_stats(course)}


@frappe.whitelist()
def get_course_students(
	course: str,
	stage: str | None = None,
	search: str | None = None,
	start: int = 0,
	page_length: int = 20,
) -> dict:
	"""One page of the course's enrolled students, newest enrollment first."""
	_check_dashboard_access(course)
	stage = _validate_stage(stage)
	search = _validate_search(search)
	start, page_length = _clamp_page(start, page_length)

	lessons = _course_lesson_names(course)
	query, fields, Enrollment = _course_students_query(course, lessons, stage, search)
	total = query.select(fn.Count(Enrollment.name)).run()[0][0]
	rows = _newest_first(query.select(*fields), Enrollment).limit(page_length).offset(start).run(as_dict=True)
	return {
		"total": cint(total),
		"rows": [_student_row(row, len(lessons)) for row in rows],
	}


@frappe.whitelist()
def get_course_student_detail(course: str, enrollment: str) -> dict:
	"""One student's progress in the course: lessons by chapter with their quiz and assignment
	results, the lesson up next, the certificate and recent activity."""
	_check_dashboard_access(course)
	if not isinstance(enrollment, str) or not enrollment:
		frappe.throw(_("Pass the enrollment name as text."), title=_("Invalid enrollment"))

	lessons = _course_lesson_names(course)
	query, fields, Enrollment = _course_students_query(course, lessons, None, None)
	rows = query.select(*fields).where(Enrollment.name == enrollment).run(as_dict=True)
	if not rows:
		frappe.throw(_("This student is not enrolled in this course."), frappe.DoesNotExistError)
	student = _student_row(rows[0], len(lessons))
	member = student["member"]

	chapters = _course_outline(course, member)
	flat = [lesson for chapter in chapters for lesson in chapter["lessons"]]
	up_next = next(
		(
			{"chapter": chapter["title"], "chapter_number": chapter["number"], **lesson}
			for chapter in chapters
			for lesson in chapter["lessons"]
			if not lesson["completed"]
		),
		None,
	)
	results = [result for lesson in flat for result in lesson["assessments"]]
	quizzes = [result for result in results if result["type"] == "quiz" and result["attempts"]]
	assignments = [result for result in results if result["type"] == "assignment"]
	certificate = (
		frappe.db.get_value("LMS Certificate", student["certificate"], ["name", "issue_date"], as_dict=True)
		if student["certificate"]
		else None
	)
	idle_since = add_days(now_datetime(), -INACTIVE_AFTER_DAYS)
	return {
		**student,
		"inactive": student["stage"] == "in_progress"
		and bool(student["last_active"])
		and get_datetime(student["last_active"]) < idle_since,
		"chapters": chapters,
		"up_next": up_next,
		"quizzes": {
			"attempted": len(quizzes),
			"passed": sum(1 for result in quizzes if result["status"] == "passed"),
			"average": flt(sum(result["score"] for result in quizzes) / len(quizzes), 1) if quizzes else None,
		},
		"assignments": {
			"total": len(assignments),
			**{
				status: sum(1 for result in assignments if result["status"] == status)
				for status in ("passed", "to_review", "failed", "not_attempted")
			},
		},
		"certificate_detail": certificate,
		"certification_enabled": bool(frappe.db.get_value("LMS Course", course, "enable_certification")),
		"activity": _course_student_activity(student, flat, certificate, _quiz_attempts(quizzes, member)),
	}


def _course_outline(course: str, member: str) -> list[dict]:
	"""The course's chapters and lessons in order, each lesson with whether the member completed
	it and their result on the quizzes and assignments it holds."""
	ChapterReference = frappe.qb.DocType("Chapter Reference")
	Chapter = frappe.qb.DocType("Course Chapter")
	LessonReference = frappe.qb.DocType("Lesson Reference")
	Lesson = frappe.qb.DocType("Course Lesson")
	Progress = frappe.qb.DocType("LMS Course Progress")
	rows = (
		frappe.qb.from_(ChapterReference)
		.join(Chapter)
		.on(Chapter.name == ChapterReference.chapter)
		.join(LessonReference)
		.on(LessonReference.parent == ChapterReference.chapter)
		.left_join(Lesson)
		.on(Lesson.name == LessonReference.lesson)
		.select(
			ChapterReference.chapter,
			ChapterReference.idx.as_("chapter_idx"),
			Chapter.title.as_("chapter_title"),
			LessonReference.lesson,
			LessonReference.idx.as_("lesson_idx"),
			Lesson.title.as_("lesson_title"),
		)
		.where((ChapterReference.parent == course) & (ChapterReference.parenttype == "LMS Course"))
		.orderby(ChapterReference.idx)
		.orderby(LessonReference.idx)
		.run(as_dict=True)
	)
	completed = dict(
		frappe.qb.from_(Progress)
		.select(Progress.lesson, fn.Max(Progress.modified))
		.where((Progress.member == member) & (Progress.course == course) & (Progress.status == "Complete"))
		.groupby(Progress.lesson)
		.run()
	)
	assessments = _lesson_assessment_results([row.lesson for row in rows], member)

	chapters = {}
	for row in rows:
		chapter = chapters.setdefault(
			row.chapter,
			{"title": row.chapter_title, "number": len(chapters) + 1, "lessons": []},
		)
		chapter["lessons"].append(
			{
				"name": row.lesson,
				"title": row.lesson_title or row.lesson,
				"number": f"{chapter['number']}.{len(chapter['lessons']) + 1}",
				"completed": row.lesson in completed,
				"completed_at": completed.get(row.lesson),
				"assessments": assessments.get(row.lesson, []),
			}
		)
	return list(chapters.values())


COURSE_ACTIVITY_LIMIT = 20


def _course_student_activity(
	student: dict, lessons: list[dict], certificate, quiz_attempts: list[dict]
) -> list[dict]:
	"""The member's latest lessons, quiz attempts and assignments in the course, newest first, with
	the certificate at the top and the enrollment at the end."""
	events = [
		{
			"kind": "lesson_completed",
			"title": lesson["title"],
			"number": lesson["number"],
			"at": lesson["completed_at"],
		}
		for lesson in lessons
		if lesson["completed_at"]
	]
	events += quiz_attempts
	events += [
		{
			"kind": f"assignment_{result['status']}",
			"title": result["title"],
			"score": None,
			"attempts": result["attempts"],
			"at": result["at"],
		}
		for lesson in lessons
		for result in lesson["assessments"]
		if result["type"] == "assignment" and result["at"]
	]
	if certificate and certificate.issue_date:
		events.append(
			{"kind": "certified", "title": certificate.name, "at": get_datetime(certificate.issue_date)}
		)
	events = sorted(events, key=lambda event: get_datetime(event["at"]), reverse=True)
	return [
		*events[:COURSE_ACTIVITY_LIMIT],
		{"kind": "enrolled", "title": None, "at": student["enrolled_on"]},
	]


@frappe.whitelist(methods=["GET"])
def export_course_analytics(
	course: str, file_format: str = "xlsx", from_date: str | None = None, to_date: str | None = None
) -> None:
	"""The course's analytics for students who enrolled between the dates, as an Excel or PDF download."""
	_check_dashboard_access(course)
	file_format = _validate_file_format(file_format)
	window = _validate_time_frame(from_date, to_date)
	send_analytics(_course_analytics(course, window), file_format)


@frappe.whitelist(methods=["GET"])
def get_course_analytics_report(course: str, from_date: str | None = None, to_date: str | None = None) -> str:
	"""The course's analytics report as HTML, for the browser to draw as an image."""
	_check_dashboard_access(course)
	window = _validate_time_frame(from_date, to_date)
	return report_html(_course_analytics(course, window), IMAGE_STUDENTS)


@frappe.whitelist(methods=["GET"])
def get_course_analytics_preview(
	course: str, file_format: str = "xlsx", from_date: str | None = None, to_date: str | None = None
) -> dict:
	"""What exporting the course's analytics in this format would hold, with the students capped."""
	_check_dashboard_access(course)
	file_format = _validate_file_format(file_format, ANALYTICS_PREVIEW_FORMATS)
	window = _validate_time_frame(from_date, to_date)
	return report_preview(_course_analytics(course, window), file_format)


def _course_analytics(course: str, window: tuple) -> frappe._dict:
	"""The students who enrolled in the window, their headline numbers and how far they got."""
	lessons = _course_lesson_names(course)
	query, fields, Enrollment = _course_students_query(course, lessons, None, None)
	query = _enrolled_within(query, Enrollment, window)
	rows = [
		_student_row(row, len(lessons))
		for row in _newest_first(query.select(*fields), Enrollment).run(as_dict=True)
	]
	enrolled = len(rows)
	to_finish = max(len(lessons), 1)
	active_since = add_days(now_datetime(), -ACTIVE_WINDOW_DAYS)
	certified = sum(1 for row in rows if row["certificate"])
	finished = sum(1 for row in rows if row["stage"] in ("completed", "certified"))
	active = sum(1 for row in rows if row["last_active"] and get_datetime(row["last_active"]) >= active_since)
	stage_labels = _course_stage_labels()
	return _analytics_report(
		kind_label=_("Course analytics"),
		name=course,
		title=frappe.db.get_value("LMS Course", course, "title") or course,
		window=window,
		enrolled=enrolled,
		kpis=(
			(_("Enrolled"), enrolled, ""),
			(_("Active (7 days)"), active, ""),
			(_("Completion rate"), _percent(finished, enrolled), "%"),
			(_("Certified"), certified, ""),
		),
		funnel=(
			(_("Enrolled"), enrolled),
			(_("Started"), sum(1 for row in rows if row["stage"] != "not_started")),
			(
				_("Halfway"),
				sum(1 for row in rows if row["certificate"] or row["lessons_completed"] * 2 >= to_finish),
			),
			(_("Finished"), finished),
			(_("Certified"), certified),
		),
		sheet_header=_course_sheet_header(),
		sheet_rows=[_course_sheet_row(row, len(lessons)) for row in rows],
		table_header=[_("Name"), _("Email"), _("Stage"), _("Progress"), _("Last active"), _("Enrolled on")],
		table_rows=[
			[
				row["member_name"],
				row["email"],
				stage_labels[row["stage"]],
				f"{flt(row['progress'], 0):g}%",
				_report_date(row["last_active"]),
				_report_date(row["enrolled_on"]),
			]
			for row in rows
		],
	)


def _enrollment_facts(course: str, lessons: list[str]):
	"""The course's enrollments joined to each member's certificate, lessons completed and last activity."""
	Enrollment = frappe.qb.DocType("LMS Enrollment")
	certificates = _certificates_by_member(course)
	activity = _last_activity_by_member(course)
	requests = _certificate_requests_by_member(course)
	query = (
		frappe.qb.from_(Enrollment)
		.left_join(certificates)
		.on(certificates.member == Enrollment.member)
		.left_join(activity)
		.on(activity.member == Enrollment.member)
		.left_join(requests)
		.on(requests.member == Enrollment.member)
		.where(Enrollment.course == course)
	)
	lessons_completed = ValueWrapper(0)
	# When the student finished: the certificate's issue date, else when the last lesson was completed.
	finished_at = Case().when(certificates.certificate.isnotnull(), certificates.issued_on)
	if lessons:
		per_member = _lessons_completed_query(course, lessons).as_("per_member")
		query = query.left_join(per_member).on(per_member.member == Enrollment.member)
		lessons_completed = fn.Coalesce(per_member.lessons_completed, 0)
		finished_at = finished_at.when(lessons_completed >= len(lessons), per_member.last_completed_at)

	facts = frappe._dict(
		enrollment=Enrollment,
		certificate=certificates.certificate,
		lessons_completed=lessons_completed,
		finished_at=finished_at,
		last_active=activity.last_active,
		requested_on=requests.requested_on,
		# A course with no lessons has nothing to finish: no count reaches 1.
		lessons_to_finish=max(len(lessons), 1),
	)
	return query, facts


def _course_students_query(course: str, lessons: list[str], stage: str | None, search: str | None):
	"""The enrolled-students query with no select list, its row fields, and the enrollment table."""
	query, facts = _enrollment_facts(course, lessons)
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
		query = query.where(_stage_condition(stage, facts, now_datetime()))
	if search:
		pattern = f"%{_escape_like(search)}%"
		query = query.where(
			User.full_name.like(pattern)
			| User.email.like(pattern)
			| Enrollment.member.like(pattern)
			| Enrollment.member_name.like(pattern)
		)

	fields = (
		Enrollment.name.as_("enrollment"),
		Enrollment.member,
		fn.Coalesce(User.full_name, Enrollment.member_name).as_("member_name"),
		fn.Coalesce(User.user_image, Enrollment.member_image).as_("member_image"),
		User.email,
		facts.lessons_completed.as_("lessons_completed"),
		facts.last_active.as_("last_active"),
		facts.certificate.as_("certificate"),
		Payment.name.as_("payment"),
		Payment.payment_received,
		Payment.amount,
		Payment.currency,
		Enrollment.creation.as_("enrolled_on"),
	)
	return query, fields, Enrollment


def _course_sheet_header() -> list[str]:
	return [
		_("Name"),
		_("Email"),
		_("Stage"),
		_("Lessons completed"),
		_("Total lessons"),
		_("Progress (%)"),
		_("Payment status"),
		_("Amount"),
		_("Currency"),
		_("Last active"),
		_("Enrolled on"),
		_("Certificate"),
	]


def _course_stage_labels() -> dict:
	return {
		"not_started": _("Not started"),
		"in_progress": _("In progress"),
		"completed": _("Completed"),
		"certified": _("Certified"),
	}


def _course_sheet_row(row: dict, total_lessons: int) -> list:
	return [
		row["member_name"],
		row["email"],
		_course_stage_labels()[row["stage"]],
		row["lessons_completed"],
		total_lessons,
		flt(row["progress"], 2),
		_payment_labels()[row["payment_status"]],
		row["amount"],
		row["currency"],
		_sheet_datetime(row["last_active"]),
		_sheet_datetime(row["enrolled_on"]),
		row["certificate"],
	]


def _check_dashboard_access(course) -> None:
	if not isinstance(course, str) or not course:
		frappe.throw(_("Pass the course name as text."), title=_("Invalid course"))
	if not can_modify_course(course):
		frappe.throw(
			_("Only this course's instructors and Moderators can see its dashboard."),
			frappe.PermissionError,
			title=_("Not permitted"),
		)


def _course_lesson_names(course: str) -> list[str]:
	LessonReference = frappe.qb.DocType("Lesson Reference")
	ChapterReference = frappe.qb.DocType("Chapter Reference")
	return (
		frappe.qb.from_(LessonReference)
		.join(ChapterReference)
		.on(LessonReference.parent == ChapterReference.chapter)
		.select(LessonReference.lesson)
		.distinct()
		.where((ChapterReference.parent == course) & (ChapterReference.parenttype == "LMS Course"))
		.run(pluck=True)
	)


def _course_has_evaluation(course: str) -> bool:
	paid_certificate, evaluator = frappe.db.get_value(
		"LMS Course", course, ["paid_certificate", "evaluator"]
	) or (0, None)
	return bool(paid_certificate or evaluator)


def _certificate_requests_by_member(course: str):
	Request = frappe.qb.DocType("LMS Certificate Request")
	return (
		frappe.qb.from_(Request)
		.select(Request.member, fn.Max(Request.date).as_("requested_on"))
		.where((Request.course == course) & (Request.status != "Cancelled"))
		.groupby(Request.member)
		.as_("requests")
	)


def _certificates_by_member(course: str):
	Certificate = frappe.qb.DocType("LMS Certificate")
	return (
		frappe.qb.from_(Certificate)
		.select(
			Certificate.member,
			fn.Max(Certificate.name).as_("certificate"),
			fn.Min(Certificate.issue_date).as_("issued_on"),
		)
		.where(Certificate.course == course)
		.groupby(Certificate.member)
		.as_("certificates")
	)


def _activity_events(course: str, since=None):
	"""(member, at) for every lesson visit, quiz attempt and assignment submission in the course,
	from `since` on when given: each branch filters before the union is built."""
	Progress = frappe.qb.DocType("LMS Course Progress")
	Quiz = frappe.qb.DocType("LMS Quiz Submission")
	Assignment = frappe.qb.DocType("LMS Assignment Submission")

	def branch(table, at):
		query = frappe.qb.from_(table).select(table.member, at.as_("at")).where(table.course == course)
		return query.where(at >= since) if since else query

	return (
		branch(Progress, Progress.modified)
		.union_all(branch(Quiz, Quiz.creation))
		.union_all(branch(Assignment, Assignment.creation))
		.as_("events")
	)


def _last_activity_by_member(course: str):
	events = _activity_events(course)
	return (
		frappe.qb.from_(events)
		.select(events.member, fn.Max(events.at).as_("last_active"))
		.groupby(events.member)
		.as_("activity")
	)


def _stage_condition(stage: str, facts: frappe._dict, now):
	"""SQL twin of `_stage`, plus the `inactive` and funnel filters."""
	if stage == "active":
		return facts.last_active >= add_days(now, -ACTIVE_WINDOW_DAYS)
	certified = facts.certificate.isnotnull()
	if stage == "certified":
		return certified
	lessons_completed = facts.lessons_completed
	if stage == "started":
		return certified | (lessons_completed > 0)
	if stage == "halfway":
		return certified | (lessons_completed * 2 >= facts.lessons_to_finish)
	if stage == "finished":
		return certified | (lessons_completed >= facts.lessons_to_finish)
	if stage == "evaluation_requested":
		return certified | ((lessons_completed >= facts.lessons_to_finish) & facts.requested_on.isnotnull())
	finished = lessons_completed >= facts.lessons_to_finish
	if stage == "completed":
		return certified.negate() & finished
	if stage == "not_started":
		return certified.negate() & (lessons_completed == 0)
	in_progress = certified.negate() & (lessons_completed > 0) & finished.negate()
	if stage == "in_progress":
		return in_progress
	# A student in progress has completed a lesson, which is itself an activity, so
	# `last_active` is never null here.
	return in_progress & (facts.last_active < add_days(now, -INACTIVE_AFTER_DAYS))


def _stage(lessons_completed: int, total_lessons: int, certificate: str | None) -> str:
	if certificate:
		return "certified"
	if total_lessons and lessons_completed >= total_lessons:
		return "completed"
	if lessons_completed <= 0:
		return "not_started"
	return "in_progress"


def _enrollment_summary(course: str, lessons: list[str], now, checkpoints: list) -> frappe._dict:
	query, facts = _enrollment_facts(course, lessons)
	enrolled_on = facts.enrollment.creation
	window_start = add_days(now, -DELTA_WINDOW_DAYS)
	previous_window_start = add_days(now, -2 * DELTA_WINDOW_DAYS)

	return query.select(
		fn.Count(facts.enrollment.name).as_("enrolled"),
		*(_count_where(_stage_condition(key, facts, now)).as_(key) for key in STUDENT_FILTERS),
		_count_where(facts.last_active >= add_days(now, -ACTIVE_WINDOW_DAYS)).as_("active_7d"),
		_count_where(enrolled_on >= window_start).as_("enrolled_last_window"),
		_count_where((enrolled_on >= previous_window_start) & (enrolled_on < window_start)).as_(
			"enrolled_previous_window"
		),
		*(_count_where(enrolled_on < at).as_(f"enrolled_by_{index}") for index, at in enumerate(checkpoints)),
		*(
			_count_where(facts.finished_at < at).as_(f"finished_by_{index}")
			for index, at in enumerate(checkpoints)
		),
	).run(as_dict=True)[0]


def _review_backlog(course: str, checkpoints: list) -> list[int]:
	"""Submissions of enrolled students waiting for a grade at each checkpoint."""
	Submission = frappe.qb.DocType("LMS Assignment Submission")
	query = _enrolled_only(frappe.qb.from_(Submission), Submission).where(Submission.course == course)
	return _review_backlog_counts(query, Submission, checkpoints)


def _enrolled_only(query, Submission):
	Enrollment = frappe.qb.DocType("LMS Enrollment")
	return query.join(Enrollment).on(
		(Enrollment.member == Submission.member) & (Enrollment.course == Submission.course)
	)


def _weekly_trends(course: str, lessons: list[str], weeks: list) -> dict:
	now = now_datetime()
	Enrollment = frappe.qb.DocType("LMS Enrollment")
	Certificate = frappe.qb.DocType("LMS Certificate")
	Progress = frappe.qb.DocType("LMS Course Progress")
	# The trend weeks and the two delta windows are all this reads of the activity.
	events = _activity_events(course, since=min(weeks[0], getdate(add_days(now, -2 * DELTA_WINDOW_DAYS))))

	lessons_completed = [0] * len(weeks)
	if lessons:
		completions = (
			frappe.qb.from_(Progress)
			.join(Enrollment)
			.on((Enrollment.member == Progress.member) & (Enrollment.course == Progress.course))
			.where(
				(Progress.course == course) & (Progress.status == "Complete") & Progress.lesson.isin(lessons)
			)
		)
		lessons_completed = _weekly_counts(completions, Progress.creation, weeks)

	active_members = (
		frappe.qb.from_(events)
		.join(Enrollment)
		.on(Enrollment.member == events.member)
		.where(Enrollment.course == course)
	)
	certificates = frappe.qb.from_(Certificate).where(Certificate.course == course)
	return {
		"weeks": [str(week) for week in weeks],
		"enrollments": _weekly_counts(
			frappe.qb.from_(Enrollment).where(Enrollment.course == course), Enrollment.creation, weeks
		),
		"lessons_completed": lessons_completed,
		"certificates": _weekly_counts(certificates, Certificate.issue_date, weeks),
		"active": _weekly_counts(active_members, events.at, weeks, fn.Count(events.member).distinct()),
		"active_windows": _windowed_counts(
			active_members,
			events.at,
			lambda condition: fn.Count(Case().when(condition, events.member)).distinct(),
			now,
		),
		"certificate_windows": _windowed_counts(
			certificates, Certificate.issue_date, _count_where, getdate(now)
		),
	}


def _quiz_stats(course: str) -> list[dict]:
	Quiz = frappe.qb.DocType("LMS Quiz")
	Submission = frappe.qb.DocType("LMS Quiz Submission")
	attempts = _enrolled_only(frappe.qb.from_(Submission), Submission).where(Submission.course == course)
	own = frappe.qb.from_(Quiz).select(Quiz.name, Quiz.title).where(Quiz.course == course).run(as_dict=True)
	return _quiz_rows(attempts, Submission, own)


def _assignment_stats(course: str) -> list[dict]:
	Assignment = frappe.qb.DocType("LMS Assignment")
	Submission = frappe.qb.DocType("LMS Assignment Submission")
	submissions = _enrolled_only(frappe.qb.from_(Submission), Submission).where(Submission.course == course)
	own = (
		frappe.qb.from_(Assignment)
		.select(Assignment.name, Assignment.title)
		.where(Assignment.course == course)
		.run(as_dict=True)
	)
	return _assignment_rows(submissions, Submission, own)


def _course_rating_trends(course: str, now) -> dict:
	Review = frappe.qb.DocType("LMS Course Review")
	window_start = _month_ago(now)
	previous_start = add_days(now, -2 * DELTA_WINDOW_DAYS)
	rated = fn.NullIf(Review.rating, 0)
	summary = (
		frappe.qb.from_(Review)
		.select(
			fn.Avg(Case().when(Review.creation >= window_start, rated)).as_("last_window"),
			fn.Avg(
				Case().when((Review.creation >= previous_start) & (Review.creation < window_start), rated)
			).as_("previous_window"),
		)
		.where(Review.course == course)
		.run(as_dict=True)[0]
	)
	out_of = cint(frappe.get_meta("LMS Course Review").get_field("rating").options) or 5

	def stars(rating):
		return None if rating is None else flt(flt(rating) * out_of, 2)

	weeks = _trend_weeks(now)
	by_week = _weekly_values(
		frappe.qb.from_(Review).where(Review.course == course), Review.creation, weeks, fn.Avg(rated)
	)
	weekly, carried = [], None
	for index in range(len(weeks)):
		# A week with no review keeps the average of the last week that had one.
		carried = stars(by_week[index]) if by_week.get(index) is not None else carried
		weekly.append(carried)

	return {
		"last_window": stars(summary.last_window),
		"previous_window": stars(summary.previous_window),
		"weekly": weekly,
	}


def _lessons_completed_query(course: str, lessons: list[str]):
	Progress = frappe.qb.DocType("LMS Course Progress")
	return (
		frappe.qb.from_(Progress)
		.select(
			Progress.member,
			fn.Count(Progress.lesson).distinct().as_("lessons_completed"),
			fn.Max(Progress.creation).as_("last_completed_at"),
		)
		.where((Progress.course == course) & (Progress.status == "Complete") & Progress.lesson.isin(lessons))
		.groupby(Progress.member)
	)


def _student_row(row: frappe._dict, total_lessons: int) -> dict:
	payment_status = _payment_status(row)
	has_payment = bool(row.payment)
	lessons_completed = cint(row.lessons_completed)

	return {
		"enrollment": row.enrollment,
		"member": row.member,
		"member_name": row.member_name,
		"member_image": row.member_image,
		"email": row.email,
		"progress": flt(lessons_completed * 100 / total_lessons, 2) if total_lessons else 0.0,
		"lessons_completed": lessons_completed,
		"stage": _stage(lessons_completed, total_lessons, row.certificate),
		"certificate": row.certificate,
		"payment_status": payment_status,
		"amount": flt(row.amount) if has_payment else None,
		"currency": row.currency if has_payment else None,
		"last_active": row.last_active,
		"enrolled_on": row.enrolled_on,
	}


@frappe.whitelist(methods=["POST"])
def send_course_reminder(course: str, enrollment: str) -> dict:
	"""Email one student of the course a nudge back to the lesson up next."""
	_check_dashboard_access(course)
	member = _reminder_member(
		"LMS Enrollment", enrollment, "course", course, _("This student is not enrolled in this course.")
	)
	up_next = next(
		(
			lesson["title"]
			for chapter in _course_outline(course, member)
			for lesson in chapter["lessons"]
			if not lesson["completed"]
		),
		None,
	)
	title = frappe.db.get_value("LMS Course", course, "title")
	return _send_reminder("LMS Enrollment", enrollment, member, title, f"courses/{course}", up_next)


@frappe.whitelist(methods=["POST"])
def issue_course_certificate(course: str, enrollment: str) -> dict:
	"""Certify a student of the course who has completed every lesson."""
	_check_dashboard_access(course)
	if not isinstance(enrollment, str) or not enrollment:
		frappe.throw(_("Pass the enrollment name as text."), title=_("Invalid enrollment"))
	member = frappe.db.get_value("LMS Enrollment", {"name": enrollment, "course": course}, "member")
	if not member:
		frappe.throw(_("This student is not enrolled in this course."), frappe.DoesNotExistError)
	# Same course lock as the student's create_certificate, so a staff issue and a
	# self-claim (or two quick clicks) serialize and the second sees the first.
	frappe.db.get_value("LMS Course", course, "name", for_update=True)
	if not frappe.db.get_value("LMS Course", course, "enable_certification"):
		frappe.throw(_("Certification is not enabled for this course."), title=_("Not certifiable"))
	if get_latest_certificate(member, course, for_update=True):
		frappe.throw(
			_("This student already has a certificate for this course."), title=_("Already certified")
		)

	lessons = _course_lesson_names(course)
	Progress = frappe.qb.DocType("LMS Course Progress")
	completed = (
		_lessons_completed_query(course, lessons).where(Progress.member == member).run(as_dict=True)
		if lessons
		else []
	)
	if not completed or cint(completed[0].lessons_completed) < len(lessons):
		frappe.throw(
			_("This student has not completed every lesson of the course yet."), title=_("Not finished")
		)

	certificate = frappe.get_doc(
		{
			"doctype": "LMS Certificate",
			"member": member,
			"course": course,
			"batch_name": get_enrollment_batch(course, member),
			"issue_date": nowdate(),
			"template": get_default_certificate_template(),
		}
	)
	# nosemgrep: lms-unjustified-ignore-permissions - _check_dashboard_access above is the authorization
	certificate.save(ignore_permissions=True)
	return {"name": certificate.name, "course": course}
