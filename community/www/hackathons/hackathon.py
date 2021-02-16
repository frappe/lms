from __future__ import unicode_literals
import frappe
from frappe import _

def get_context(context):
    context.no_cache = 1
    try:
        hackathon = frappe.form_dict['hackathon']
    except KeyError:
        frappe.local.flags.redirect_location = '/hackathons'
        raise frappe.Redirect
    context.projects = get_hackathon_projects(hackathon)
    context.hackathon = hackathon

def get_hackathon_projects(hackathon):
    return frappe.get_all("Community Project", filters={"event":hackathon}, fields=["name", "project_short_intro"])