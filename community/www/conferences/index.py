import frappe

def get_context(context):
	context.no_cache = 1
	context.conferences = get_conferences()

def get_conferences():
	return frappe.get_all("Community Conference", fields=["name", "live_stream_url"])