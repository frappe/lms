from __future__ import unicode_literals
import frappe
from frappe import _

def get_context(context):
	context.no_cache = 1
	try:
		project = frappe.form_dict['project']
		hackathon = frappe.form_dict['hackathon']
	except KeyError:
		frappe.local.flags.redirect_location = '/hackathons'
		raise frappe.Redirect
	context.project = get_project(project)
	context.hackathon = hackathon
	context.members = get_members(project)
	context.confirmed_members = get_comfirmed_members(project)
	context.updates = get_updates(project)
	if frappe.session.user != "Guest":
		context.my_project = get_my_projects()
		context.is_owner = context.project.owner == frappe.session.user
		context.accepted_members = get_accepted_members(project)
		context.is_member = check_is_member(project)
		context.liked = get_liked_project(project)

def get_project(project_name):
	try:
		return frappe.get_doc('Community Project', project_name)
	except frappe.DoesNotExistError:
		frappe.throw(_("Project {0} does not exist.").format(project_name))

def get_members(project_name):
	return frappe.get_all("Community Project Member", {"project": project_name, "status": ("!=", "Rejected") }, ['name', "owner", "status", 'intro'])

def get_comfirmed_members(project_name):
	return frappe.get_all("Community Project Member", {"project": project_name, "status": ("=", "Accepted") }, ['name'])

def get_updates(project_name):
	return frappe.get_all('Community Project Update', {"project": project_name}, ['owner', 'creation', '`update` as project_update'])

def get_accepted_members(project_name):
	return frappe.get_all("Community Project Member", {"project": project_name, "status": "Accepted" })

def get_my_projects():
	my_project = frappe.db.get_value('Community Project', {"owner": frappe.session.user})
	if not my_project:
		my_project = frappe.db.get_value('Community Project Member', {"owner": frappe.session.user, "status": 'Accepted'}, 'project')
	return my_project

def check_is_member(project_name):
	return frappe.get_all("Community Project Member", {"project": project_name, "status": "Accepted", "owner": frappe.session.user })

def get_liked_project(project_name):
	return frappe.db.get_value("Community Project Like", {"owner": frappe.session.user, "project": project_name})

@frappe.whitelist()
def join_request(id, action):
	if action == 'Accept':
		project_member = frappe.get_doc('Community Project Member', id)
		if len(frappe.db.get_all('Community Project Member', 
			dict(project = project_member.project, status = 'Accepted'))) > 2:
			frappe.throw('A project cannot have more than 4 members')
		frappe.db.set_value('Community Project Member', id, 'status', 'Accepted')
	else:
		frappe.db.set_value('Community Project Member', id, 'status', 'Rejected')

def has_already_liked(project):
	likes = frappe.db.get_value('Community Project Like', {"owner": frappe.session.user, "project": project})
	return likes

@frappe.whitelist()
def get_project_likes(project):
	return len(frappe.get_all("Community Project Like", {"project": project}))

@frappe.whitelist()
def like(project, initial=False):
	liked_project = has_already_liked(project)
	action = "Liked" if (liked_project and initial) else "Unliked"
	if not initial:
		if liked_project:
			action = "Unliked"
			frappe.get_doc("Community Project Like", liked_project).delete()
		else:
			action = "Liked"
			frappe.get_doc({"doctype": "Community Project Like","project": project}).save()

	frappe.db.set_value("Community Project", project, "likes", get_project_likes(project))
	return {
		"action": action,
		"likes": get_project_likes(project)
	}
