import frappe


@frappe.whitelist(allow_guest=True)
def get_add_on_details(plan: str) -> dict[str, int]:
	"""
	Returns the number of courses and course members to be billed under add-ons for SAAS subscription
	"""

	return {"courses": get_add_on_courses(plan), "members": get_add_on_members(plan)}


def get_published_courses() -> int:
	return frappe.db.count("LMS Course", {"published": 1})


def get_add_on_courses(plan: str) -> int:
	COURSE_LIMITS = {"Lite": 5, "Pro": 20}
	add_on_courses = 0
	courses_included_in_plans = COURSE_LIMITS.get(plan)

	if courses_included_in_plans:
		published_courses = get_published_courses()
		add_on_courses = (
			published_courses - courses_included_in_plans
			if published_courses > courses_included_in_plans
			else 0
		)

	return add_on_courses


def get_add_on_members(plan: str) -> int:
	MEMBER_LIMITS = {"Lite": 500, "Pro": 1000}
	add_on_members = 0
	members_included_in_plans = MEMBER_LIMITS.get(plan)

	if members_included_in_plans:
		active_members = get_members()
		add_on_members = (
			active_members - members_included_in_plans
			if active_members > members_included_in_plans
			else 0
		)

	return add_on_members


def get_members() -> int:
	return frappe.db.count("LMS Enrollment")
