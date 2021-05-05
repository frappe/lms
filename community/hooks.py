# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from . import __version__ as app_version
from .install import APP_LOGO_URL

app_name = "community"
app_title = "Community"
app_publisher = "FOSS United"
app_description = "Community App"
app_icon = "octicon octicon-file-directory"
app_color = "grey"
app_email = "jannat@erpnext.com"
app_license = "AGPL"

app_logo_url = APP_LOGO_URL

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_css = "/assets/community/css/community.css"
app_include_js = "/assets/community/js/community.js"

# include js, css files in header of web template
web_include_css = "/assets/css/community.css"
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
after_install = "community.install.after_install"

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

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"User": {
		"after_insert": "community.community.doctype.community_member.community_member.create_member_from_user"
	},
    "LMS Message": {
        "after_insert": "community.lms.doctype.lms_message.lms_message.publish_message"
    }
 }

# Scheduled Tasks
# ---------------
#scheduler_events = {
#	"daily": [
#		"erpnext.stock.reorder_item.reorder_item"
#	]
#}

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
    {"from_route": "/courses/<course>/<batch>/learn", "to_route": "courses/learn"},
    {"from_route": "/courses/<course>/<batch>/schedule", "to_route": "courses/schedule"},
    {"from_route": "/courses/<course>/<batch>/members", "to_route": "courses/members"},
    {"from_route": "/courses/<course>/<batch>/discuss", "to_route": "courses/discuss"},
    {"from_route": "/courses/<course>/<batch>/about", "to_route": "courses/about"}
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
    "/join-request"
    "/add-a-new-batch",
    "/new-sign-up",
    "/message"
]
whitelist_rules = [{"from_route": p, "to_route": p[1:]} for p in whitelist]

# regex rule to match all profiles
profile_rules = [
    {"from_route": "/<string(minlength=4):username>", "to_route": "profiles/profile"},
]

website_route_rules = primary_rules + whitelist_rules + profile_rules

update_website_context = 'community.widgets.update_website_context'
