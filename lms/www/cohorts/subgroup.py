import frappe

from . import utils


def get_context(context):
	context.no_cache = 1
	course = utils.get_course()

	cohort = utils.get_cohort(course, frappe.form_dict["cohort"])
	subgroup = utils.get_subgroup(cohort, frappe.form_dict["subgroup"])

	if not subgroup:
		context.template = "www/404.html"
		return

	page = frappe.form_dict.get("page")
	is_mentor = subgroup.is_mentor(frappe.session.user)
	is_admin = (
		cohort.is_admin(frappe.session.user) or "System Manager" in frappe.get_roles()
	)

	if is_admin:
		role = "Admin"
	elif is_mentor:
		role = "Mentor"
	else:
		role = "Public"

	pages = [
		("mentors", ["Admin", "Mentor", "Public"]),
		("students", ["Admin", "Mentor", "Public"]),
		("join-requests", ["Admin", "Mentor"]),
		("admin", ["Admin"]),
	]
	pages += [(p.slug, ["Admin", "Mentor"]) for p in cohort.get_pages(scope="Subgroup")]

	page_names = [p for p, roles in pages if role in roles]

	if page not in page_names:
		frappe.local.flags.redirect_location = subgroup.get_url() + "/mentors"
		raise frappe.Redirect

	utils.add_nav(context, "All Courses", "/courses")
	utils.add_nav(context, course.title, f"/courses/{course.name}")
	utils.add_nav(context, "Cohorts", f"/courses/{course.name}/manage")
	utils.add_nav(context, cohort.title, f"/courses/{course.name}/cohorts/{cohort.slug}")

	context.course = course
	context.cohort = cohort
	context.subgroup = subgroup
	context.stats = get_stats(subgroup)
	context.page = page
	context.is_admin = is_admin
	context.is_mentor = is_mentor
	context.page_scope = "Subgroup"

	# Function to render to custom page given the slug
	context.render_page = lambda page: frappe.render_template(
		cohort.get_page_template(page, scope="Subgroup"), context
	)


def get_stats(subgroup):
	return {
		"join_requests": len(subgroup.get_join_requests()),
		"students": len(subgroup.get_students()),
		"mentors": len(subgroup.get_mentors()),
	}


def has_page(cohort, page):
	return cohort.get_page(page, scope="Subgroup")
