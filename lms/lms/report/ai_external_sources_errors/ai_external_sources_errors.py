import frappe
from frappe import _


def execute(filters=None):
    f = frappe._dict(filters or {})
    columns = [
        {"label": _("Course"), "fieldname": "course", "fieldtype": "Link", "options": "LMS Course", "width": 160},
        {"label": _("Lesson"), "fieldname": "lesson", "fieldtype": "Link", "options": "Course Lesson", "width": 180},
        {"label": _("Title"), "fieldname": "title", "fieldtype": "Data", "width": 220},
        {"label": _("URL"), "fieldname": "url", "fieldtype": "Data", "width": 260},
        {"label": _("Status"), "fieldname": "status", "fieldtype": "Data", "width": 90},
        {"label": _("Last Fetched"), "fieldname": "last_fetched_at", "fieldtype": "Datetime", "width": 140},
        {"label": _("Error"), "fieldname": "error", "fieldtype": "Small Text", "width": 240},
    ]

    conditions = []
    params = {}
    if f.get("course"):
        conditions.append("course = %(course)s")
        params["course"] = f.course
    if f.get("lesson"):
        conditions.append("lesson = %(lesson)s")
        params["lesson"] = f.lesson
    if f.get("status"):
        conditions.append("status = %(status)s")
        params["status"] = f.status
    where = (" where " + " and ".join(conditions)) if conditions else ""

    rows = frappe.db.sql(
        f"""
        select course, lesson, title, url, status, last_fetched_at, error
        from `tabAI External Source`
        {where}
        order by status desc, last_fetched_at desc
        limit 500
        """,
        params,
        as_dict=True,
    )
    return columns, rows

