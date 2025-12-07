import frappe
from frappe import _


def execute(filters=None):
    filters = frappe._dict(filters or {})

    columns = [
        {"label": _("Course"), "fieldname": "course", "fieldtype": "Link", "options": "LMS Course", "width": 200},
        {"label": _("Lesson"), "fieldname": "lesson", "fieldtype": "Link", "options": "Course Lesson", "width": 220},
        {"label": _("Sessions"), "fieldname": "sessions", "fieldtype": "Int", "width": 100},
        {"label": _("Messages"), "fieldname": "messages", "fieldtype": "Int", "width": 100},
        {"label": _("Users"), "fieldname": "users", "fieldtype": "Int", "width": 90},
        {"label": _("First Activity"), "fieldname": "first_at", "fieldtype": "Datetime", "width": 160},
        {"label": _("Last Activity"), "fieldname": "last_at", "fieldtype": "Datetime", "width": 160},
    ]

    conditions = []
    params = {}

    if filters.get("from_date"):
        conditions.append("s.creation >= %(from_date)s")
        params["from_date"] = filters.get("from_date")
    if filters.get("to_date"):
        conditions.append("s.creation <= %(to_date)s")
        params["to_date"] = filters.get("to_date")
    if filters.get("course"):
        conditions.append("s.course = %(course)s")
        params["course"] = filters.get("course")
    if filters.get("lesson"):
        conditions.append("s.lesson = %(lesson)s")
        params["lesson"] = filters.get("lesson")

    where = (" where " + " and ".join(conditions)) if conditions else ""

    # Aggregate sessions per course/lesson
    query = f"""
        select
            s.course,
            s.lesson,
            count(distinct s.name) as sessions,
            count(m.name) as messages,
            count(distinct s.user) as users,
            min(coalesce(m.creation, s.creation)) as first_at,
            max(coalesce(m.creation, s.creation)) as last_at
        from `tabAI Chat Session` s
        left join `tabAI Chat Message` m on m.session = s.name
        {where}
        group by s.course, s.lesson
        order by last_at desc
    """

    data = frappe.db.sql(query, params, as_dict=True)
    return columns, data

