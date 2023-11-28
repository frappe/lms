from . import __version__ as app_version

app_name = "frappe_lms"
app_title = "Frappe LMS"
app_publisher = "Frappe"
app_description = "Frappe LMS App"
app_icon = "octicon octicon-file-directory"
app_color = "grey"
app_email = "school@frappe.io"
app_license = "AGPL"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/lms/css/lms.css"
# app_include_js = "/assets/lms/js/lms.js"

# include js, css files in header of web template
web_include_css = "lms.bundle.css"
# web_include_css = "/assets/lms/css/lms.css"
web_include_js = ["website.bundle.js"]

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "lms/public/scss/website"

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
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Installation
# ------------

# before_install = "lms.install.before_install"
after_install = "lms.install.after_install"
after_sync = "lms.install.after_sync"
before_uninstall = "lms.install.before_uninstall"


setup_wizard_requires = "assets/lms/js/setup_wizard.js"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "lms.notifications.get_notification_config"

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
	"User": "lms.overrides.user.CustomUser",
	"Web Template": "lms.overrides.web_template.CustomWebTemplate",
}

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"Discussion Reply": {"after_insert": "lms.lms.utils.handle_notifications"},
}

# Scheduled Tasks
# ---------------
scheduler_events = {
	"hourly": [
		"lms.lms.doctype.lms_certificate_request.lms_certificate_request.schedule_evals"
	]
}

fixtures = ["Custom Field", "Function", "Industry"]

# Testing
# -------

# before_tests = "lms.install.before_tests"

# Overriding Methods
# ------------------------------
#
override_whitelisted_methods = {
	# "frappe.desk.search.get_names_for_mentions": "lms.lms.utils.get_names_for_mentions",
}
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "lms.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Add all simple route rules here
website_route_rules = [
	{"from_route": "/sketches/<sketch>", "to_route": "sketches/sketch"},
	{"from_route": "/courses/<course>", "to_route": "courses/course"},
	{"from_route": "/courses/<course>/edit", "to_route": "courses/create"},
	{"from_route": "/courses/<course>/outline", "to_route": "courses/outline"},
	{"from_route": "/courses/<course>/<certificate>", "to_route": "courses/certificate"},
	{"from_route": "/courses/<course>/learn", "to_route": "batch/learn"},
	{
		"from_route": "/courses/<course>/learn/<int:chapter>.<int:lesson>",
		"to_route": "batch/learn",
	},
	{
		"from_route": "/courses/<course>/learn/<int:chapter>.<int:lesson>/edit",
		"to_route": "batch/edit",
	},
	{"from_route": "/quizzes", "to_route": "batch/quiz_list"},
	{"from_route": "/quizzes/<quizname>", "to_route": "batch/quiz"},
	{"from_route": "/batches/<batchname>", "to_route": "batches/batch"},
	{"from_route": "/courses/<course>/progress", "to_route": "batch/progress"},
	{"from_route": "/courses/<course>/join", "to_route": "batch/join"},
	{"from_route": "/courses/<course>/manage", "to_route": "cohorts"},
	{"from_route": "/courses/<course>/cohorts/<cohort>", "to_route": "cohorts/cohort"},
	{
		"from_route": "/courses/<course>/cohorts/<cohort>/<page>",
		"to_route": "cohorts/cohort",
	},
	{
		"from_route": "/courses/<course>/subgroups/<cohort>/<subgroup>",
		"to_route": "cohorts/subgroup",
	},
	{
		"from_route": "/courses/<course>/subgroups/<cohort>/<subgroup>/<page>",
		"to_route": "cohorts/subgroup",
	},
	{
		"from_route": "/courses/<course>/join/<cohort>/<subgroup>/<invite_code>",
		"to_route": "cohorts/join",
	},
	{"from_route": "/users", "to_route": "profiles/profile"},
	{"from_route": "/jobs/<job>", "to_route": "jobs/job"},
	{
		"from_route": "/batches/<batchname>/students/<username>",
		"to_route": "/batches/progress",
	},
	{"from_route": "/assignments/<assignment>", "to_route": "assignments/assignment"},
	{
		"from_route": "/assignment-submission/<assignment>/<submission>",
		"to_route": "assignment_submission/assignment_submission",
	},
	{
		"from_route": "/quiz-submission/<quiz>/<submission>",
		"to_route": "quiz_submission/quiz_submission",
	},
	{
		"from_route": "/billing/<module>/<modulename>",
		"to_route": "billing/billing",
	},
	{
		"from_route": "/batches/details/<batchname>",
		"to_route": "batches/batch_details",
	},
	{
		"from_route": "/certified-participants",
		"to_route": "certified_participants/certified_participants",
	},
]

website_redirects = [
	{"source": "/update-profile", "target": "/edit-profile"},
	{"source": "/dashboard", "target": "/courses"},
	{"source": "/community", "target": "/people"},
]

update_website_context = [
	"lms.widgets.update_website_context",
]

jinja = {
	"methods": [
		"lms.page_renderers.get_profile_url",
		"lms.overrides.user.get_enrolled_courses",
		"lms.overrides.user.get_course_membership",
		"lms.overrides.user.get_authored_courses",
		"lms.overrides.user.get_palette",
		"lms.lms.utils.get_membership",
		"lms.lms.utils.get_lessons",
		"lms.lms.utils.get_tags",
		"lms.lms.utils.get_instructors",
		"lms.lms.utils.get_students",
		"lms.lms.utils.get_average_rating",
		"lms.lms.utils.is_certified",
		"lms.lms.utils.get_lesson_index",
		"lms.lms.utils.get_lesson_url",
		"lms.lms.utils.get_chapters",
		"lms.lms.utils.get_slugified_chapter_title",
		"lms.lms.utils.get_progress",
		"lms.lms.utils.render_html",
		"lms.lms.utils.is_mentor",
		"lms.lms.utils.is_cohort_staff",
		"lms.lms.utils.get_mentors",
		"lms.lms.utils.get_reviews",
		"lms.lms.utils.is_eligible_to_review",
		"lms.lms.utils.get_initial_members",
		"lms.lms.utils.get_sorted_reviews",
		"lms.lms.utils.is_instructor",
		"lms.lms.utils.convert_number_to_character",
		"lms.lms.utils.get_signup_optin_checks",
		"lms.lms.utils.get_popular_courses",
		"lms.lms.utils.format_amount",
		"lms.lms.utils.first_lesson_exists",
		"lms.lms.utils.get_courses_under_review",
		"lms.lms.utils.has_course_instructor_role",
		"lms.lms.utils.has_course_moderator_role",
		"lms.lms.utils.get_certificates",
		"lms.lms.utils.format_number",
		"lms.lms.utils.get_lesson_count",
		"lms.lms.utils.get_all_memberships",
		"lms.lms.utils.get_filtered_membership",
		"lms.lms.utils.show_start_learing_cta",
		"lms.lms.utils.can_create_courses",
		"lms.lms.utils.get_telemetry_boot_info",
		"lms.lms.utils.is_onboarding_complete",
		"lms.www.utils.is_student",
	],
	"filters": [],
}
## Specify the additional tabs to be included in the user profile page.
## Each entry must be a subclass of lms.lms.plugins.ProfileTab
# profile_tabs = []

## Specify the extension to be used to control what scripts and stylesheets
## to be included in lesson pages. The specified value must be be a
## subclass of lms.plugins.PageExtension
# lms_lesson_page_extension = None

# lms_lesson_page_extensions = [
# 	"lms.plugins.LiveCodeExtension"
# ]

has_website_permission = {
	"LMS Certificate Evaluation": "lms.lms.doctype.lms_certificate_evaluation.lms_certificate_evaluation.has_website_permission"
}

profile_mandatory_fields = [
	"first_name",
	"last_name",
	"user_image",
	"bio",
	"linkedin",
	"education",
	"skill",
	"preferred_functions",
	"preferred_industries",
	"dream_companies",
	"attire",
	"collaboration",
	"role",
	"location_preference",
	"time",
	"company_type",
]

## Markdown Macros for Lessons
lms_markdown_macro_renderers = {
	"Exercise": "lms.plugins.exercise_renderer",
	"Quiz": "lms.plugins.quiz_renderer",
	"YouTubeVideo": "lms.plugins.youtube_video_renderer",
	"Video": "lms.plugins.video_renderer",
	"Assignment": "lms.plugins.assignment_renderer",
	"Embed": "lms.plugins.embed_renderer",
	"Audio": "lms.plugins.audio_renderer",
	"PDF": "lms.plugins.pdf_renderer",
}

# page_renderer to manage profile pages
page_renderer = [
	"lms.page_renderers.ProfileRedirectPage",
	"lms.page_renderers.ProfilePage",
]

# set this to "/" to have profiles on the top-level
profile_url_prefix = "/users/"

signup_form_template = "lms.plugins.show_custom_signup"

on_session_creation = "lms.overrides.user.on_session_creation"
