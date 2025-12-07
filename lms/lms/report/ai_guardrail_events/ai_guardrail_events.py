import frappe
from frappe import _


def execute(filters=None):
    f = frappe._dict(filters or {})
    columns = [
        {"label": _("Time"), "fieldname": "time", "fieldtype": "Datetime", "width": 160},
        {"label": _("User"), "fieldname": "user", "fieldtype": "Link", "options": "User", "width": 180},
        {"label": _("Course"), "fieldname": "course", "fieldtype": "Link", "options": "LMS Course", "width": 180},
        {"label": _("Lesson"), "fieldname": "lesson", "fieldtype": "Link", "options": "Course Lesson", "width": 200},
        {"label": _("Source"), "fieldname": "source", "fieldtype": "Data", "width": 90},
        {"label": _("Type"), "fieldname": "event_type", "fieldtype": "Data", "width": 90},
        {"label": _("Snippet"), "fieldname": "snippet", "fieldtype": "Small Text", "width": 260},
        {"label": _("Notes"), "fieldname": "notes", "fieldtype": "Small Text", "width": 200},
    ]

    conditions = []
    params = {}
    if f.get("from"):
        conditions.append("time >= %(from)s")
        params["from"] = f["from"]
    if f.get("to"):
        conditions.append("time <= %(to)s")
        params["to"] = f["to"]
    if f.get("course"):
        conditions.append("course = %(course)s")
        params["course"] = f.course
    if f.get("lesson"):
        conditions.append("lesson = %(lesson)s")
        params["lesson"] = f.lesson
    if f.get("source"):
        conditions.append("source = %(source)s")
        params["source"] = f.source
    if f.get("event_type"):
        conditions.append("event_type = %(event_type)s")
        params["event_type"] = f.event_type
    if f.get("user"):
        conditions.append("user = %(user)s")
        params["user"] = f.user

    where = (" where " + " and ".join(conditions)) if conditions else ""
    rows = frappe.db.sql(
        f"""
        select time, user, course, lesson, source, event_type, snippet, notes
        from `tabAI Guardrail Event`
        {where}
        order by time desc
        limit 500
        """,
        params,
        as_dict=True,
    )
    return columns, rows

