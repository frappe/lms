# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from . import __version__ as app_version

app_name = "school"
app_title = "School"
app_publisher = "Frappe"
app_description = "School"
app_icon = "octicon octicon-file-directory"
app_color = "grey"
app_email = "school@frappe.io"
app_license = "AGPL"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/school/css/school.css"
# app_include_js = "/assets/school/js/school.js"

# include js, css files in header of web template
web_include_css = "school.bundle.css"
# web_include_css = "/assets/school/css/school.css"
web_include_js = "website.bundle.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "school/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
#	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Installation
# ------------

# before_install = "school.install.before_install"
# after_install = "school.install.after_install"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "school.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

override_doctype_class = {
	"User": "school.overrides.user.CustomUser",
	"Web Template": "school.overrides.web_template.CustomWebTemplate"
}

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {

}

# Scheduled Tasks
# ---------------
#scheduler_events = {
#	"daily": [
#		"erpnext.stock.reorder_item.reorder_item"
#	]
#}

fixtures = ["Custom Field", "Function", "Industry"]

# Testing
# -------

# before_tests = "school.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "school.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "school.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Add all simple route rules here
website_route_rules = [
	{"from_route": "/sketches/<sketch>", "to_route": "sketches/sketch"},
	{"from_route": "/courses/<course>", "to_route": "courses/course"},
	{"from_route": "/courses/<course>/<certificate>", "to_route": "courses/certificate"},
	{"from_route": "/hackathons/<hackathon>", "to_route": "hackathons/hackathon"},
	{"from_route": "/hackathons/<hackathon>/<project>", "to_route": "hackathons/project"},
	{"from_route": "/courses/<course>/learn", "to_route": "batch/learn"},
	{"from_route": "/courses/<course>/learn/<int:chapter>.<int:lesson>", "to_route": "batch/learn"},
	{"from_route": "/courses/<course>/progress", "to_route": "batch/progress"},
	{"from_route": "/courses/<course>/join", "to_route": "batch/join"},
	{"from_route": "/courses/<course>/manage", "to_route": "cohorts"},
	{"from_route": "/courses/<course>/cohorts/<cohort>", "to_route": "cohorts/cohort"},
	{"from_route": "/courses/<course>/cohorts/<cohort>/<page>", "to_route": "cohorts/cohort"},
	{"from_route": "/courses/<course>/subgroups/<cohort>/<subgroup>", "to_route": "cohorts/subgroup"},
	{"from_route": "/courses/<course>/subgroups/<cohort>/<subgroup>/<page>", "to_route": "cohorts/subgroup"},
	{"from_route": "/courses/<course>/join/<cohort>/<subgroup>/<invite_code>", "to_route": "cohorts/join"},
	{"from_route": "/users", "to_route": "profiles/profile"},
    {"from_route": "/jobs/<job>", "to_route": "jobs/job"}
]

website_redirects = [
	{"source": "/update-profile", "target": "/edit-profile"},
]

update_website_context = [
    'school.widgets.update_website_context',
]

jinja = {
    "methods": [
        "school.page_renderers.get_profile_url",
        "school.overrides.user.get_authored_courses",
        "school.overrides.user.get_palette",
        "school.lms.utils.get_membership",
        "school.lms.utils.get_lessons",
        "school.lms.utils.get_tags",
        "school.lms.utils.get_instructors",
        "school.lms.utils.get_students",
        "school.lms.utils.get_average_rating",
        "school.lms.utils.is_certified",
        "school.lms.utils.get_lesson_index",
        "school.lms.utils.get_lesson_url",
        "school.lms.utils.get_chapters",
        "school.lms.utils.get_slugified_chapter_title",
        "school.lms.utils.get_progress",
        "school.lms.utils.render_html",
        "school.lms.utils.is_mentor",
        "school.lms.utils.is_cohort_staff",
        "school.lms.utils.get_mentors",
        "school.lms.utils.get_reviews",
        "school.lms.utils.is_eligible_to_review",
        "school.lms.utils.get_initial_members",
        "school.lms.utils.get_sorted_reviews",
        "school.lms.utils.is_instructor",
        "school.lms.utils.convert_number_to_character",
        "school.lms.utils.get_signup_optin_checks"
    ],
    "filters": []
}
## Specify the additional tabs to be included in the user profile page.
## Each entry must be a subclass of school.school.plugins.ProfileTab
# profile_tabs = []

## Specify the extension to be used to control what scripts and stylesheets
## to be included in lesson pages. The specified value must be be a
## subclass of school.plugins.PageExtension
# school_lesson_page_extension = None

#school_lesson_page_extensions = [
#	"school.plugins.LiveCodeExtension"
#]

profile_mandatory_fields = [
    "first_name",
    "last_name",
    "user_image",
    "bio",
    "linkedin",
    "education",
    "work_experience",
    "skill",
    "preferred_functions",
    "preferred_industries",
    "dream_companies",
    "attire",
    "collaboration",
    "role",
    "location_preference",
    "time",
    "company_type"
]

## Markdown Macros for Lessons
school_markdown_macro_renderers = {
    "Exercise": "school.plugins.exercise_renderer",
    "Quiz": "school.plugins.quiz_renderer",
    "YouTubeVideo": "school.plugins.youtube_video_renderer",
    "Video": "school.plugins.video_renderer",
    "Assignment": "school.plugins.assignment_renderer"
}

# page_renderer to manage profile pages
page_renderer = [
	"school.page_renderers.ProfileRedirectPage",
	"school.page_renderers.ProfilePage"
]

# set this to "/" to have profiles on the top-level
profile_url_prefix = "/users/"

signup_form_template = "school.plugins.show_custom_signup"

on_login = "school.overrides.user.set_country_from_ip"
