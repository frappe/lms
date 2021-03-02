import frappe

def get_context(context):
	context.no_cache = 1
	context.hackathons = get_hackathons()

def get_hackathons():
	return frappe.get_all("Community Hackathon")