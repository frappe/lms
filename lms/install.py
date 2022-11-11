import frappe
from frappe.desk.page.setup_wizard.setup_wizard import add_all_roles_to


def after_install():
	add_pages_to_nav()


def after_sync():
	create_lms_roles()
	set_default_home()
	add_all_roles_to("Administrator")


def after_uninstall():
	delete_custom_fields()


def create_lms_roles():
	create_instructor_role()
	create_moderator_role()


def set_default_home():
	frappe.db.set_value("Portal Settings", None, "default_portal_home", "/courses")


def create_instructor_role():
	if not frappe.db.exists("Role", "Course Instructor"):
		role = frappe.get_doc(
			{
				"doctype": "Role",
				"role_name": "Course Instructor",
				"home_page": "",
				"desk_access": 0,
			}
		)
		role.save(ignore_permissions=True)


def create_moderator_role():
	if not frappe.db.exists("Role", "Course Moderator"):
		role = frappe.get_doc(
			{
				"doctype": "Role",
				"role_name": "Course Moderator",
				"home_page": "",
				"desk_access": 0,
			}
		)
		role.save(ignore_permissions=True)


def delete_custom_fields():
	fields = [
		"user_category",
		"headline",
		"college",
		"city",
		"verify_terms",
		"country",
		"preferred_location",
		"preferred_functions",
		"preferred_industries",
		"work_environment_column",
		"time",
		"role",
		"carrer_preference_details",
		"skill",
		"certification_details",
		"internship",
		"branch",
		"github",
		"medium",
		"linkedin",
		"profession",
		"looking_for_job",
		"cover_image" "work_environment",
		"dream_companies",
		"career_preference_column",
		"attire",
		"collaboration",
		"location_preference",
		"company_type",
		"skill_details",
		"certification",
		"education",
		"work_experience",
		"education_details",
		"hide_private",
		"work_experience_details",
		"profile_complete",
	]

	for field in fields:
		frappe.db.delete("Custom Field", {"fieldname": field})
		frappe.db.commit()


def add_pages_to_nav():
	pages = [
		{"label": "Courses", "url": "/courses", "parent": "Explore", "idx": 2},
		{"label": "Statistics", "url": "/statistics", "parent": "Explore", "idx": 3},
		{"label": "Jobs", "url": "/jobs", "parent": "Explore", "idx": 4},
		{"label": "People", "url": "/community", "parent": "Explore", "idx": 5},
	]

	if not frappe.db.exists("Top Bar Item", {"label": "Explore"}):
		frappe.get_doc(
			{
				"doctype": "Top Bar Item",
				"label": "Explore",
				"parent": "Website Settings",
				"parenttype": "Website Settings",
				"parentfield": "top_bar_items",
				"idx": 1,
			}
		).save()

	for page in pages:
		if not frappe.db.exists(
			"Top Bar Item", {"url": ["like", "%" + page.get("url") + "%"]}
		):
			frappe.get_doc(
				{
					"doctype": "Top Bar Item",
					"label": page.get("label"),
					"url": page.get("url"),
					"parent_label": page.get("parent"),
					"idx": page.get("idx"),
					"parent": "Website Settings",
					"parenttype": "Website Settings",
					"parentfield": "top_bar_items",
				}
			).save()
