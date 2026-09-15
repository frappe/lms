import frappe
from frappe import _
from frappe.utils import nowdate

# The categories the palette may narrow a search to. SQLiteSearch binds filter
# *values* but interpolates the column name, so the doctype has to come from this
# table rather than from anything the caller sent.
CATEGORY_DOCTYPES = {
	"courses": "LMS Course",
	"batches": "LMS Batch",
	"jobs": "Job Opportunity",
	"quizzes": "LMS Quiz",
	"assignments": "LMS Assignment",
	"programs": "LMS Program",
}

# Which group each doctype lands in, and the order the groups come back in.
DOCTYPE_GROUPS = {
	"LMS Course": "Courses",
	"LMS Batch": "Batches",
	"Job Opportunity": "Job Opportunities",
	"LMS Quiz": "Quizzes",
	"LMS Assignment": "Assignments",
	"LMS Program": "Programs",
}

# Courses, batches and jobs keep their hand-written visibility rules below.
PERMISSION_CHECKED_DOCTYPES = ("LMS Quiz", "LMS Assignment", "LMS Program")

# LMS Quiz and LMS Assignment grant `read` to LMS Student with no
# permission_query_conditions hook, so frappe.get_list hands a student every row
# on the site — 272 quizzes and 40 assignments on the dev bench, and an
# assignment's indexed content is its full question text. They are authoring
# surfaces, gated in the sidebar the same way, so they are scoped by hand here:
# a moderator sees all, an instructor sees their own courses', nobody else sees
# any. LMS Program is left to get_list, which its own hook does constrain.
COURSE_SCOPED_DOCTYPES = ("LMS Quiz", "LMS Assignment")

AUTHORING_ROLES = ("Moderator", "Course Creator", "Batch Evaluator")

# All of an index row that a palette row draws, and so all of it that leaves the
# server. `title_only` makes frappe select the raw `content` column rather than a
# snippet of it, so an unprojected row carries a whole course description or
# assignment question — up to 100 of them per keystroke, for a UI that renders
# the title and a relative date.
RESULT_FIELDS = ("doctype", "name", "title", "modified")


@frappe.whitelist()
def search_sqlite(query: str, category: str | None = None):
	from lms.sqlite import LearningSearch, LearningSearchIndexMissingError

	if not isinstance(query, str):
		frappe.throw(_("Search query must be text."))

	filters = {}
	if category is not None:
		if not isinstance(category, str):
			frappe.throw(_("Search category must be text."))
		if category not in CATEGORY_DOCTYPES:
			frappe.throw(_("Unknown search category: {0}").format(category))
		filters["doctype"] = CATEGORY_DOCTYPES[category]

	search = LearningSearch()

	try:
		# Title only. The index matches descriptions too, so "cour" returned every
		# course whose blurb said "course" — and since a row renders its title and
		# nothing else, the reason for the match was invisible and the hit read as
		# unrelated. 53 matches across 10 titles became 6 across 4 on the dev site.
		result = search.search(query, title_only=True, filters=filters)
	except LearningSearchIndexMissingError:
		return []

	return prepare_search_results(result)


def prepare_search_results(result: dict):
	groups = get_grouped_results(result)

	out = []
	for key in DOCTYPE_GROUPS.values():
		if key not in groups:
			continue
		items = remove_duplicates(groups[key])
		items.sort(key=lambda x: x.get("modified"), reverse=True)
		out.append({"title": key, "items": [as_palette_item(item) for item in items]})

	return out


def as_palette_item(row):
	return {field: row.get(field) for field in RESULT_FIELDS}


def get_grouped_results(result):
	roles = frappe.get_roles()
	rows = [row for row in result["results"] if describes_its_own_doc(row)]
	permitted = get_permitted_names(rows)

	groups = {}
	for r in rows:
		doctype = r["doctype"]
		group = DOCTYPE_GROUPS.get(doctype)
		if not group or not is_visible(r, doctype, roles, permitted):
			continue
		groups.setdefault(group, []).append(r)
	return groups


def describes_its_own_doc(row):
	"""Whether an index row still stands for the document it names.

	Course Instructor rows used to be indexed and then rewritten to look like
	their parent course, which left `id` naming the child row while `doctype`
	and `name` named the course. They stopped being indexed, but every
	`learning.db` built before that still holds them, frozen at whatever
	`published` said when they were written — and `remove_duplicates` runs after
	the visibility check, so an unpublished course kept surfacing through its
	stale twin. `remove_doc` deletes by `LMS Course:<name>` and never reaches
	one, so they outlive the course itself until the index is rebuilt.
	"""
	return row.get("id") == f"{row.get('doctype')}:{row.get('name')}"


def is_visible(row, doctype, roles, permitted):
	if doctype == "LMS Course":
		return can_access_course(row, roles)
	if doctype == "LMS Batch":
		return can_access_batch(row, roles)
	if doctype == "Job Opportunity":
		return can_access_job(row, roles)
	return row.get("name") in permitted.get(doctype, ())


def get_permitted_names(rows):
	"""Names the session user may read, one query per doctype rather than one per row.

	Going through get_list means the doctype's own role permissions decide, and a
	permission_query_conditions hook still applies — LMS Program registers one.
	A user with no read access to the doctype at all raises, which is that user
	seeing none of it, not the whole search failing.
	"""
	wanted = {}
	for row in rows:
		if row["doctype"] in PERMISSION_CHECKED_DOCTYPES:
			wanted.setdefault(row["doctype"], set()).add(row["name"])

	permitted = {}
	for doctype, names in wanted.items():
		if doctype in COURSE_SCOPED_DOCTYPES:
			permitted[doctype] = get_authored_names(doctype, names)
			continue
		try:
			permitted[doctype] = set(
				frappe.get_list(
					doctype,
					filters={"name": ("in", list(names))},
					pluck="name",
					limit_page_length=0,
				)
			)
		except frappe.PermissionError:
			permitted[doctype] = set()
	return permitted


def get_authored_names(doctype, names):
	"""Quiz and assignment rows the session user authored or moderates."""
	roles = set(frappe.get_roles())
	if not roles & set(AUTHORING_ROLES):
		return set()
	if "Moderator" in roles:
		return set(names)

	courses = get_instructed_courses()
	rows = frappe.get_all(
		doctype,
		filters={"name": ("in", list(names))},
		fields=["name", "course", "owner"],
		limit_page_length=0,
	)
	# `course` is optional on both doctypes and the quiz form never asks for it,
	# so course alone loses an author the quiz they have just made. It is also
	# the only way in for a Batch Evaluator, who instructs no courses at all.
	return {
		row.name for row in rows if row.owner == frappe.session.user or (row.course and row.course in courses)
	}


def get_instructed_courses():
	return set(
		frappe.get_all(
			"Course Instructor",
			filters={"instructor": frappe.session.user, "parenttype": "LMS Course"},
			pluck="parent",
		)
	)


def remove_duplicates(items):
	seen = set()
	unique_items = []
	for item in items:
		if item["name"] not in seen:
			seen.add(item["name"])
			unique_items.append(item)
	return unique_items


def can_access_course(course, roles):
	if can_create_course(roles):
		return True
	elif course.get("published"):
		return True
	return False


def can_access_batch(batch, roles):
	if can_create_batch(roles):
		return True
	elif batch.get("published") and batch.get("start_date") >= nowdate():
		return True
	return False


def can_access_job(job, roles):
	if "Moderator" in roles:
		return True
	return job.get("status") == "Open"


def can_create_course(roles):
	return "Course Creator" in roles or "Moderator" in roles


def can_create_batch(roles):
	return "Batch Evaluator" in roles or "Moderator" in roles
