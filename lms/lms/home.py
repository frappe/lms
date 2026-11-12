"""What a learner is working through, for the home page: skills, courses and batches in one list."""

import frappe
from frappe import _
from frappe.utils import add_days, cint, date_diff, flt, formatdate, getdate, nowdate, pretty_date

from lms.lms.telemetry import demo_course


@frappe.whitelist()
def my_learning_home() -> list[dict]:
	"""The caller's own skills, courses and batches, most recently touched first."""
	user = frappe.session.user
	if user == "Guest":
		return []
	items = [*_skills(user), *_courses(user), *_batches(user)]
	items.sort(key=lambda item: item["modified"], reverse=True)
	return items


def _skills(user: str) -> list[dict]:
	rows = frappe.get_all(
		"LMS Goal Assignment",
		filters={"member": user, "is_preview": 0},
		fields=["goal", "goal_title", "status", "due_date", "progress", "score", "ready_on", "modified"],
	)
	items = []
	for row in rows:
		parts = frappe.db.count("LMS Goal Activity", {"parent": row.goal, "parenttype": "LMS Goal"})
		done = round(flt(row.progress) * parts / 100) if parts else 0
		finished = row.status == "Ready"
		if finished:
			meta = _("Finished {0}").format(_when(row.ready_on)) if row.ready_on else _("Finished")
		elif not done:
			minutes = cint(frappe.db.get_value("LMS Goal", row.goal, "minutes"))
			meta = _("Not started · about {0} minutes").format(minutes) if minutes else _("Not started")
		else:
			meta = _("{0} of {1} parts").format(done, parts)
		if not finished and row.due_date:
			meta += " · " + _("due {0}").format(_when(row.due_date))
		items.append(
			_item(
				"Skill",
				row.goal_title,
				meta,
				finished,
				row.modified,
				progress=row.progress,
				summary=_("{0} of {1} parts").format(done, parts),
				due_date=row.due_date,
				route={"name": "GoalSession", "params": {"goal": row.goal}},
			)
		)
	return items


def _courses(user: str) -> list[dict]:
	rows = frappe.get_all(
		"LMS Enrollment",
		filters={"member": user},
		fields=["course", "progress", "modified"],
	)
	items = []
	for row in rows:
		title = frappe.db.get_value("LMS Course", row.course, "title")
		if not title:
			continue
		lessons = frappe.db.count("Course Lesson", {"course": row.course})
		done = round(flt(row.progress) * lessons / 100) if lessons else 0
		finished = flt(row.progress) >= 100
		if finished:
			meta = _("Finished")
		elif not done:
			meta = _("Not started · {0} lessons").format(lessons)
		else:
			meta = _("{0} of {1} lessons").format(done, lessons)
		items.append(
			_item(
				"Course",
				title,
				meta,
				finished,
				row.modified,
				progress=row.progress,
				summary=_("{0} of {1} lessons").format(done, lessons),
				route=_next_lesson_route(row.course, user),
			)
		)
	return items


def _next_lesson_route(course: str, user: str) -> dict:
	"""The first lesson the learner has not finished, in course order, so Continue picks up there.
	The course page when there is nothing to open."""
	chapters = frappe.get_all(
		"Chapter Reference", filters={"parent": course}, fields=["chapter", "idx"], order_by="idx asc"
	)
	done = set(
		frappe.get_all(
			"LMS Course Progress",
			filters={"course": course, "member": user, "status": "Complete"},
			pluck="lesson",
		)
	)
	first = None
	for chapter in chapters:
		lessons = frappe.get_all(
			"Lesson Reference",
			filters={"parent": chapter.chapter},
			fields=["lesson", "idx"],
			order_by="idx asc",
		)
		for lesson in lessons:
			spot = {"chapterNumber": chapter.idx, "lessonNumber": lesson.idx}
			first = first or spot
			if lesson.lesson not in done:
				return {"name": "Lesson", "params": {"courseName": course, **spot}}
	if first:
		return {"name": "Lesson", "params": {"courseName": course, **first}}
	return {"name": "CourseDetail", "params": {"courseName": course}}


def _batches(user: str) -> list[dict]:
	rows = frappe.get_all(
		"LMS Batch Enrollment",
		filters={"member": user},
		fields=["batch", "modified"],
	)
	today = getdate(nowdate())
	items = []
	for row in rows:
		batch = frappe.db.get_value("LMS Batch", row.batch, ["title", "start_date", "end_date"], as_dict=True)
		if not batch:
			continue
		finished = bool(batch.end_date and getdate(batch.end_date) < today)
		next_class = frappe.db.get_value(
			"LMS Live Class",
			{"batch_name": row.batch, "date": [">=", today]},
			"date",
			order_by="date asc",
		)
		if finished:
			meta = _("Ended {0}").format(_when(batch.end_date))
		elif batch.start_date and getdate(batch.start_date) > today:
			meta = _("Starts {0}").format(_when(batch.start_date))
		elif next_class:
			meta = _("Next live class {0}").format(_when(next_class))
		elif batch.end_date:
			meta = _("Ends {0}").format(_when(batch.end_date))
		else:
			meta = _("In progress")
		items.append(
			_item(
				"Batch",
				batch.title,
				meta,
				finished,
				row.modified,
				route={"name": "BatchDetail", "params": {"batchName": row.batch}},
			)
		)
	return items


def _when(date) -> str:
	"""A weekday when it is within the week ahead, else a short date such as 30 Nov."""
	days = date_diff(date, nowdate())
	if days == 0:
		return _("today")
	if days == 1:
		return _("tomorrow")
	if 1 < days < 7:
		return formatdate(date, "EEEE")
	return formatdate(date, "d MMM")


def _item(kind, title, meta, finished, modified, **extra) -> dict:
	return {
		"type": kind,
		"title": title,
		"meta": meta,
		"done": finished,
		"modified": modified,
		**extra,
	}


# A learner with nothing yet


@frappe.whitelist()
def discover_home() -> dict:
	"""What someone with nothing to learn yet can start: popular courses, skills open to everyone
	and public batches that start soon."""
	if frappe.session.user == "Guest":
		return {"courses": [], "skills": [], "batches": []}
	return {"courses": _popular_courses(), "skills": _open_skills(), "batches": _upcoming_batches()}


@frappe.whitelist(methods=["POST"])
def join_skill(goal: str) -> str:
	"""Give the caller a skill that is open to everyone, for people who joined after it went out."""
	user = frappe.session.user
	if user == "Guest":
		frappe.throw(_("Log in to start this skill."), frappe.PermissionError)
	open_to_all = frappe.db.get_value(
		"LMS Goal", goal, ["status", "assign_everyone", "due_date"], as_dict=True
	)
	if not open_to_all or open_to_all.status != "Published" or not open_to_all.assign_everyone:
		frappe.throw(_("This skill is not open to everyone."), frappe.PermissionError)
	# Two taps on Start at once: the lock on the goal row makes the second one wait and find the first.
	frappe.db.get_value("LMS Goal", goal, "name", for_update=True)
	# nosemgrep: lms-exists-then-insert - serialised by the FOR UPDATE lock on the goal above
	if not frappe.db.exists("LMS Goal Assignment", {"goal": goal, "member": user, "is_preview": 0}):
		# nosemgrep: lms-unjustified-ignore-permissions - a learner joining an open skill; learners cannot create assignments
		frappe.get_doc(
			{
				"doctype": "LMS Goal Assignment",
				"goal": goal,
				"member": user,
				"due_date": open_to_all.due_date,
			}
		).insert(ignore_permissions=True)
	return goal


def _popular_courses(limit: int = 3) -> list[dict]:
	"""Published courses with the most learners, in the same shape the course list cards use."""
	from lms.lms.utils import get_course_details

	Course = frappe.qb.DocType("LMS Course")
	Enrollment = frappe.qb.DocType("LMS Enrollment")
	names = (
		frappe.qb.from_(Course)
		.left_join(Enrollment)
		.on(Enrollment.course == Course.name)
		.select(Course.name)
		.where(Course.published == 1)
		.where(Course.upcoming == 0)
		.groupby(Course.name)
		.orderby(frappe.query_builder.functions.Count(Enrollment.name), order=frappe.qb.desc)
		.orderby(Course.name)
		.limit(limit)
		.run(pluck=True)
	)
	return [details for details in (get_course_details(name) for name in names) if details]


def _open_skills(limit: int = 3) -> list[dict]:
	"""Published skills open to everyone that the caller does not have yet."""
	user = frappe.session.user
	mine = frappe.get_all("LMS Goal Assignment", filters={"member": user, "is_preview": 0}, pluck="goal")
	filters = {"status": "Published", "assign_everyone": 1}
	if mine:
		filters["name"] = ["not in", mine]
	rows = frappe.get_all(
		"LMS Goal",
		filters=filters,
		fields=["name", "title", "minutes", "outcome", "learner_outcome", "owner"],
		order_by="published_on desc",
		limit=limit,
	)
	for row in rows:
		row.instructor = frappe.db.get_value(
			"User", row.pop("owner"), ["full_name", "user_image as image"], as_dict=True
		)
		row.enrolled_count = frappe.db.count("LMS Goal Assignment", {"goal": row.name, "is_preview": 0})
	return rows


def _upcoming_batches(limit: int = 3) -> list[dict]:
	"""Published batches that have not started, in the same shape the batch list cards use."""
	from lms.lms.utils import get_batch_card_details

	rows = frappe.get_all(
		"LMS Batch",
		filters={"published": 1, "start_date": [">=", nowdate()]},
		fields=[
			"name",
			"title",
			"description",
			"seat_count",
			"paid_batch",
			"amount",
			"amount_usd",
			"currency",
			"start_date",
			"end_date",
			"start_time",
			"end_time",
			"timezone",
			"published",
			"category",
		],
		order_by="start_date asc",
		limit=limit,
	)
	return get_batch_card_details(rows)


# What an instructor made


@frappe.whitelist()
def admin_home() -> dict:
	"""The caller's own skills, courses and batches, newest change first, with the draft they
	touched last."""
	user = frappe.session.user
	if user == "Guest":
		return {"items": [], "resume": None}
	items = [*_made_skills(user), *_made_courses(user), *_made_batches(user)]
	items.sort(key=lambda item: item["modified"], reverse=True)
	drafts = [item for item in items if not item["published"]]
	return {
		"items": items,
		"resume": drafts[0] if drafts else None,
		"example": _example_course(),
	}


def _made_skills(user: str) -> list[dict]:
	rows = frappe.get_all("LMS Goal", filters={"owner": user}, fields=["name", "title", "status", "modified"])
	items = []
	for row in rows:
		published = row.status == "Published"
		if published:
			meta = _skill_reach(row.name)
		else:
			parts = frappe.db.count("LMS Goal Activity", {"parent": row.name, "parenttype": "LMS Goal"})
			meta = _("{0} parts").format(parts) if parts else _("No plan yet")
			meta += " · " + _("edited {0}").format(pretty_date(row.modified))
		items.append(
			_made("Skill", row, published, meta, {"name": "GoalBuilder", "params": {"goal": row.name}})
		)
	return items


def _skill_reach(goal: str) -> str:
	people = frappe.get_all(
		"LMS Goal Assignment", filters={"goal": goal, "is_preview": 0}, fields=["status", "progress"]
	)
	if not people:
		return _("No one has it yet")
	waiting = sum(1 for person in people if person.status != "Ready" and not flt(person.progress))
	if waiting:
		return _("{0} of {1} people have not started").format(waiting, len(people))
	ready = sum(1 for person in people if person.status == "Ready")
	return _("{0} of {1} people are ready").format(ready, len(people))


def _made_courses(user: str) -> list[dict]:
	names = _taught_by(user, "LMS Course")
	# The demo course is set up with the first admin as its instructor; it is an example,
	# not their work, so it never stops them seeing the first-time home.
	names.discard(demo_course())
	if not names:
		return []
	rows = frappe.get_all(
		"LMS Course",
		filters={"name": ["in", list(names)]},
		fields=["name", "title", "published", "modified"],
	)
	week_ago = add_days(nowdate(), -7)
	items = []
	for row in rows:
		if row.published:
			enrolled = frappe.db.count("LMS Enrollment", {"course": row.name})
			finished = frappe.db.count(
				"LMS Enrollment", {"course": row.name, "progress": [">=", 100], "modified": [">=", week_ago]}
			)
			if not enrolled:
				meta = _("No one enrolled yet")
			elif finished:
				meta = _("{0} finished this week · {1} enrolled").format(finished, enrolled)
			else:
				meta = _("{0} enrolled").format(enrolled)
		else:
			chapters = frappe.db.count("Course Chapter", {"course": row.name})
			meta = _("{0} chapters").format(chapters) if chapters else _("No chapters yet")
			meta += " · " + _("edited {0}").format(pretty_date(row.modified))
		items.append(
			_made(
				"Course",
				row,
				bool(row.published),
				meta,
				{"name": "CourseDetail", "params": {"courseName": row.name}},
			)
		)
	return items


def _made_batches(user: str) -> list[dict]:
	names = _taught_by(user, "LMS Batch")
	if not names:
		return []
	rows = frappe.get_all(
		"LMS Batch",
		filters={"name": ["in", list(names)]},
		fields=["name", "title", "published", "modified", "start_date", "end_date"],
	)
	today = getdate(nowdate())
	items = []
	for row in rows:
		people = frappe.db.count("LMS Batch Enrollment", {"batch": row.name})
		if row.published:
			next_class = frappe.db.get_value(
				"LMS Live Class",
				{"batch_name": row.name, "date": [">=", today]},
				"date",
				order_by="date asc",
			)
			if row.end_date and getdate(row.end_date) < today:
				meta = _("Ended {0}").format(_when(row.end_date))
			elif row.start_date and getdate(row.start_date) > today:
				meta = _("Starts {0}").format(_when(row.start_date))
			elif next_class:
				meta = _("Next live class {0}").format(_when(next_class))
			else:
				meta = _("In progress")
			meta += " · " + (_("1 person") if people == 1 else _("{0} people").format(people))
		else:
			meta = _("edited {0}").format(pretty_date(row.modified))
		items.append(
			_made(
				"Batch",
				row,
				bool(row.published),
				meta,
				{"name": "BatchDetail", "params": {"batchName": row.name}},
			)
		)
	return items


def _taught_by(user: str, doctype: str) -> set[str]:
	"""What the user teaches. The instructors are the makers; whoever saved the record counts only
	when it has no instructors, so a course set up by Administrator for someone else is theirs."""
	names = set(
		frappe.get_all(
			"Course Instructor", filters={"instructor": user, "parenttype": doctype}, pluck="parent"
		)
	)
	taught = set(frappe.get_all("Course Instructor", filters={"parenttype": doctype}, pluck="parent"))
	saved = frappe.get_all(doctype, filters={"owner": user}, pluck="name")
	names.update(name for name in saved if name not in taught)
	return names


def _example_course(lessons: int = 3) -> dict | None:
	"""The demo course, shown on the first-time home as an example of a course: its title, its
	first lessons in order and whether it ends in a certificate."""
	demo = demo_course()
	if not demo:
		return None
	course = frappe.db.get_value("LMS Course", demo, ["title", "enable_certification"], as_dict=True)
	steps = []
	for chapter in frappe.get_all(
		"Chapter Reference", filters={"parent": demo}, fields=["chapter"], order_by="idx asc"
	):
		titles = frappe.get_all(
			"Lesson Reference",
			filters={"parent": chapter.chapter},
			fields=["lesson.title as title"],
			order_by="idx asc",
		)
		steps.extend(row.title for row in titles if row.title)
		if len(steps) >= lessons:
			break
	return {
		"name": demo,
		"title": course.title,
		"lessons": steps[:lessons],
		"certificate": bool(course.enable_certification),
		"route": {"name": "CourseDetail", "params": {"courseName": demo}},
	}


def _made(kind, row, published, meta, route) -> dict:
	return {
		"type": kind,
		"name": row.name,
		"title": row.title,
		"meta": meta,
		"published": published,
		"modified": row.modified,
		"route": route,
	}
