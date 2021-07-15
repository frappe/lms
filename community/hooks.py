# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from . import __version__ as app_version

app_name = "community"
app_title = "Community"
app_publisher = "FOSS United"
app_description = "Community App"
app_icon = "octicon octicon-file-directory"
app_color = "grey"
app_email = "jannat@erpnext.com"
app_license = "AGPL"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/community/css/community.css"
# app_include_js = "/assets/community/js/community.js"

# include js, css files in header of web template
web_include_css = "community.bundle.css"
# web_include_css = "/assets/community/css/community.css"
# web_include_js = "/assets/community/js/community.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "community/public/scss/website"

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

# before_install = "community.install.before_install"
# after_install = "community.install.after_install"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "community.notifications.get_notification_config"

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
	"User": "community.overrides.user.CustomUser"
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

fixtures = ["Custom Field"]

# Testing
# -------

# before_tests = "community.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "community.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "community.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Add all simple route rules here
primary_rules = [
    {"from_route": "/sketches/<sketch>", "to_route": "sketches/sketch"},
    {"from_route": "/courses/<course>", "to_route": "courses/course"},
    {"from_route": "/courses/<course>/<topic>", "to_route": "courses/topic"},
    {"from_route": "/hackathons/<hackathon>", "to_route": "hackathons/hackathon"},
    {"from_route": "/hackathons/<hackathon>/<project>", "to_route": "hackathons/project"},
    {"from_route": "/dashboard", "to_route": ""},
    {"from_route": "/add-a-new-batch", "to_route": "add-a-new-batch"},
    {"from_route": "/courses/<course>/home", "to_route": "batch/home"},
    {"from_route": "/courses/<course>/learn", "to_route": "batch/learn"},
    {"from_route": "/courses/<course>/learn/<int:chapter>.<int:lesson>", "to_route": "batch/learn"},
    {"from_route": "/courses/<course>/schedule", "to_route": "batch/schedule"},
    {"from_route": "/courses/<course>/members", "to_route": "batch/members"},
    {"from_route": "/courses/<course>/discuss", "to_route": "batch/discuss"},
    {"from_route": "/courses/<course>/about", "to_route": "batch/about"},
    {"from_route": "/courses/<course>/progress", "to_route": "batch/progress"},
    {"from_route": "/courses/<course>/join", "to_route": "batch/join"}
]

# Any frappe default URL is blocked by profile-rules, add it here to unblock it
whitelist = [
    "/home",
    "/login",
    "/update-password",
    "/update-profile",
    "/third-party-apps",
    "/website_script.js",
    "/courses",
    "/sketches",
    "/admin",
    "/socket.io",
    "/hackathons",
    "/dashboard",
    "/join-request",
    "/add-a-new-batch",
    "/new-sign-up",
    "/message",
    "/about",
    "/edit-profile"
]
whitelist_rules = [{"from_route": p, "to_route": p[1:]} for p in whitelist]

# regex rule to match all profiles
profile_rules = [
    {"from_route": "/<string(minlength=4):username>", "to_route": "profiles/profile"},
]

website_route_rules = primary_rules + whitelist_rules + profile_rules

website_redirects = [
    {"source": "/update-profile", "target": "/edit-profile"},
]

update_website_context = 'community.widgets.update_website_context'

## Specify the additional tabs to be included in the user profile page.
## Each entry must be a subclass of community.community.plugins.ProfileTab
# profile_tabs = []

## Specify the extension to be used to control what scripts and stylesheets
## to be included in lesson pages. The specified value must be be a
## subclass of community.community.plugins.PageExtension
# community_lesson_page_extension = None

community_lesson_page_extensions = [
	"community.plugins.LiveCodeExtension"
]

## Markdown Macros for Lessons
community_markdown_macro_renderers = {
	"Exercise": "community.plugins.exercise_renderer",
	"Quiz": "community.plugins.quiz_renderer",
	"YouTubeVideo": "community.plugins.youtube_video_renderer",
}
