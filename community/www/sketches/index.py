import frappe
from ...lms.doctype.lms_sketch.lms_sketch import get_recent_sketches

def get_context(context):
    context.no_cache = 1
    context.sketches = get_recent_sketches()

