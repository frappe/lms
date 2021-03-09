import frappe

def get_context(context):
    context.no_cache = 1
    context.sketches = get_sketches()

def get_sketches():
    sketches = frappe.get_all(
        "LMS Sketch",
        fields=['name', 'title', 'owner', 'modified'],
        order_by='modified desc',
        page_length=100
    )
    for s in sketches:
        s['owner'] = s['owner'].split("@")[0]
    return sketches
