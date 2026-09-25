"""Who may do what. Every check runs against the real signed-in user.

The Gateway calls tools on behalf of the teacher or learner using the widget,
so Frappe roles and course membership of that person decide access. The
``AI Engine`` role is reserved for background jobs and can only draft.
"""

import hashlib

import frappe
from frappe import _

AI_ENGINE_ROLE = "AI Engine"
ADMIN_ROLES = {"System Manager"}
TEACHER_ROLES = {"Moderator", "Course Creator", "System Manager"}
REVIEWER_ROLES = {"Moderator", "Batch Evaluator", "System Manager"}

LEARNER = "learner"
TEACHER = "teacher"
REVIEWER = "reviewer"
ENGINE = "engine"


def current_user():
	return frappe.session.user


def roles(user=None):
	return set(frappe.get_roles(user or current_user()))


def is_guest(user=None):
	return (user or current_user()) == "Guest"


def is_admin(user=None):
	user = user or current_user()
	return user == "Administrator" or bool(ADMIN_ROLES & roles(user))


def is_engine(user=None):
	"""Administrator holds every role, so it is never mistaken for the service account."""
	user = user or current_user()
	return user != "Administrator" and AI_ENGINE_ROLE in roles(user)


def audiences(user=None):
	"""The tool audiences the user belongs to."""
	user = user or current_user()
	if is_guest(user):
		return set()
	user_roles = roles(user)
	result = {LEARNER}
	if user == "Administrator" or TEACHER_ROLES & user_roles:
		result.add(TEACHER)
	if user == "Administrator" or REVIEWER_ROLES & user_roles:
		result.add(REVIEWER)
	if is_engine(user):
		result.add(ENGINE)
	return result


def require_login():
	if is_guest():
		frappe.throw(_("Please sign in to use the learning assistant."), frappe.PermissionError)


def is_instructor(course, user=None):
	return bool(
		frappe.db.exists(
			"Course Instructor",
			{"instructor": user or current_user(), "parent": course, "parenttype": "LMS Course"},
		)
	)


def can_teach_course(course, user=None):
	"""Teachers own a course's content: moderators and the course's instructors."""
	user = user or current_user()
	if is_guest(user) or not course:
		return False
	if is_admin(user) or "Moderator" in roles(user):
		return True
	return is_instructor(course, user)


def can_review_course(course, user=None):
	"""Reviewers may also be batch evaluators who do not author the course."""
	user = user or current_user()
	if can_teach_course(course, user):
		return True
	return bool(REVIEWER_ROLES & roles(user)) and not is_guest(user)


def is_enrolled(course, user=None):
	return bool(frappe.db.exists("LMS Enrollment", {"course": course, "member": user or current_user()}))


def can_read_course(course, user=None):
	"""Learners read courses they are enrolled in. Engine and teachers read all they serve."""
	user = user or current_user()
	if is_guest(user):
		return False
	if can_review_course(course, user) or is_engine(user):
		return True
	return is_enrolled(course, user)


def assert_teacher(course):
	if not can_teach_course(course):
		frappe.throw(_("You do not teach this course."), frappe.PermissionError)


def assert_reviewer(course):
	if not can_review_course(course):
		frappe.throw(_("You cannot review work for this course."), frappe.PermissionError)


def assert_course_reader(course):
	if not can_read_course(course):
		frappe.throw(_("You are not enrolled in this course."), frappe.PermissionError)


def assert_engine_or_reviewer(course):
	if is_engine() or can_review_course(course):
		return
	frappe.throw(_("Only the review agent or a teacher can do this."), frappe.PermissionError)


def teachable_courses(user=None):
	"""Course names a teacher can review, or None for every course."""
	user = user or current_user()
	if is_admin(user) or REVIEWER_ROLES & roles(user):
		return None
	return frappe.get_all(
		"Course Instructor",
		filters={"instructor": user, "parenttype": "LMS Course"},
		pluck="parent",
	)


def learner_ref(user):
	"""A stable pseudonym, so prompts never carry a learner's email or phone."""
	secret = frappe.local.conf.get("encryption_key") or frappe.local.site or ""
	digest = hashlib.sha256(f"{secret}:{user}".encode()).hexdigest()
	return "L-" + digest[:10].upper()


def resolve_learner_refs(course, refs):
	"""Map pseudonyms back to members enrolled in ``course``; unknown refs are rejected."""
	members = frappe.get_all("LMS Enrollment", filters={"course": course}, pluck="member")
	by_ref = {learner_ref(member): member for member in members}
	resolved = []
	for ref in refs:
		member = by_ref.get(ref)
		if not member:
			frappe.throw(_("Learner {0} is not enrolled in this course.").format(ref), frappe.ValidationError)
		if member not in resolved:
			resolved.append(member)
	return resolved
