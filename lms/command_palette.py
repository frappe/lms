import frappe
from frappe.utils import nowdate


@frappe.whitelist()
def search_sqlite(query: str):
	from lms.sqlite import LearningSearch, LearningSearchIndexMissingError

	search = LearningSearch()

	try:
		result = search.search(query)
	except LearningSearchIndexMissingError:
		return []

	return prepare_search_results(result)


def prepare_search_results(result):
	roles = frappe.get_roles()
	groups = {}

	for r in result["results"]:
		doctype = r["doctype"]
		if doctype == "LMS Course" and can_access_course(r, roles):
			r["author_info"] = get_instructor_info(doctype, r)
			groups.setdefault("Courses", []).append(r)
		elif doctype == "LMS Batch" and can_access_batch(r, roles):
			r["author_info"] = get_instructor_info(doctype, r)
			groups.setdefault("Batches", []).append(r)
		elif doctype == "Job Opportunity" and can_access_job(r, roles):
			r["author_info"] = get_instructor_info(doctype, r)
			groups.setdefault("Job Opportunities", []).append(r)

	out = []
	for key in groups:
		out.append({"title": key, "items": groups[key]})

	return out


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


def get_instructor_info(doctype, record):
	instructors = frappe.get_all(
		"Course Instructor", filters={"parenttype": doctype, "parent": record.get("name")}, pluck="instructor"
	)

	instructor = record.get("author")
	if len(instructors):
		instructor = instructors[0]

	return frappe.db.get_value(
		"User",
		instructor,
		["full_name", "email", "user_image", "username"],
		as_dict=True,
	)
