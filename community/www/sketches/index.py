import frappe
from community.lms.models import Sketch

def get_context(context):
    context.no_cache = 1
    context.sketches = Sketch.get_recent_sketches()

