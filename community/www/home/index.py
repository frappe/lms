import frappe
from community.lms.models import Course, Sketch

def get_context(context):
	context.no_cache = 1
	context.courses = Course.find_all()
	context.recent_sketches = Sketch.get_recent_sketches(limit=8)
