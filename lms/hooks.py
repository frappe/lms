from . import __version__ as app_version

app_name = "frappe_lms"
app_title = "Frappe LMS"
app_publisher = "Frappe"
app_description = "Frappe LMS App"
app_icon_url = "/assets/lms/images/lms-logo.png"
app_icon_title = "Learning"
app_icon_route = "/lms"
app_color = "grey"
app_email = "jannat@frappe.io"
app_license = "AGPL"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/lms/css/lms.css"
# app_include_js = "/assets/lms/js/lms.js"

# include js, css files in header of web template
web_include_css = "lms.bundle.css"
# web_include_css = "/assets/lms/css/lms.css"
web_include_js = []

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
	"Web Template": "lms.overrides.web_template.CustomWebTemplate",
}

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"*": {
		"on_change": [
			"lms.lms.doctype.lms_badge.lms_badge.process_badges",
		]
	},
	"Discussion Reply": {"after_insert": "lms.lms.utils.handle_notifications"},
	"Notification Log": {"on_change": "lms.lms.utils.publish_notifications"},
	"User": {
		"validate": "lms.lms.user.validate_username_duplicates",
		"after_insert": "lms.lms.user.after_insert",
	},
}

# Scheduled Tasks
# ---------------
scheduler_events = {
	"hourly": [
		"lms.lms.doctype.lms_certificate_request.lms_certificate_request.schedule_evals",
		"lms.lms.api.update_course_statistics",
		"lms.lms.doctype.lms_certificate_request.lms_certificate_request.mark_eval_as_completed",
		"lms.lms.doctype.lms_live_class.lms_live_class.update_attendance",
	],
	"daily": [
		"lms.job.doctype.job_opportunity.job_opportunity.update_job_openings",
		"lms.lms.doctype.lms_payment.lms_payment.send_payment_reminder",
		"lms.lms.doctype.lms_batch.lms_batch.send_batch_start_reminder",
		"lms.lms.doctype.lms_live_class.lms_live_class.send_live_class_reminder",
	],
}

fixtures = ["Custom Field", "Function", "Industry", "LMS Category"]

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
	{"from_route": "/lms/<path:app_path>", "to_route": "lms"},
	{
		"from_route": "/courses/<course_name>/<certificate_id>",
		"to_route": "certificate",
	},
]

website_redirects = [
	{"source": "/update-profile", "target": "/edit-profile"},
	{"source": "/courses", "target": "/lms/courses"},
	{
		"source": r"^/courses/.*$",
		"target": "/lms/courses",
	},
	{"source": "/batches", "target": "/lms/batches"},
	{
		"source": r"/batches/(.*)",
		"target": "/lms/batches",
		"match_with_query_string": True,
	},
	{"source": "/job-openings", "target": "/lms/job-openings"},
	{
		"source": r"/job-openings/(.*)",
		"target": "/lms/job-openings",
		"match_with_query_string": True,
	},
	{"source": "/statistics", "target": "/lms/statistics"},
]

update_website_context = [
	"lms.widgets.update_website_context",
]

jinja = {
	"methods": [
		"lms.lms.utils.get_signup_optin_checks",
		"lms.lms.utils.get_tags",
		"lms.lms.utils.get_lesson_count",
		"lms.lms.utils.get_instructors",
		"lms.lms.utils.get_lesson_index",
		"lms.lms.utils.get_lesson_url",
		"lms.page_renderers.get_profile_url",
		"lms.lms.utils.is_instructor",
		"lms.lms.utils.get_palette",
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
	"LMS Certificate Evaluation": "lms.lms.doctype.lms_certificate_evaluation.lms_certificate_evaluation.has_website_permission",
	"LMS Certificate": "lms.lms.doctype.lms_certificate.lms_certificate.has_website_permission",
}

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
	"lms.page_renderers.SCORMRenderer",
]

# set this to "/" to have profiles on the top-level
profile_url_prefix = "/users/"

signup_form_template = "lms.plugins.show_custom_signup"

on_login = "lms.lms.user.on_login"

add_to_apps_screen = [
	{
		"name": "lms",
		"logo": "/assets/lms/frontend/learning.svg",
		"title": "Learning",
		"route": "/lms",
		"has_permission": "lms.lms.api.check_app_permission",
	}
]
