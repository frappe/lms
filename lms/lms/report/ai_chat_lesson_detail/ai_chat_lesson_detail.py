import frappe
from frappe import _


def execute(filters=None):
    f = frappe._dict(filters or {})

    if not f.course or not f.lesson:
        return _columns(), []

    conditions = ["s.course = %(course)s", "s.lesson = %(lesson)s"]
    params = {"course": f.course, "lesson": f.lesson}

    if f.get("from_date"):
        conditions.append("m.creation >= %(from_date)s")
        params["from_date"] = f.from_date
    if f.get("to_date"):
        conditions.append("m.creation <= %(to_date)s")
        params["to_date"] = f.to_date

    where = " where " + " and ".join(conditions)

    query = f"""
        select
            m.creation as time,
            m.role as role,
            s.user as user,
            left(m.content, 180) as content
        from `tabAI Chat Message` m
        inner join `tabAI Chat Session` s on s.name = m.session
        {where}
        order by m.creation desc
        limit 200
    """
    data = frappe.db.sql(query, params, as_dict=True)
    return _columns(), data


def _columns():
    return [
        {"label": _("Time"), "fieldname": "time", "fieldtype": "Datetime", "width": 170},
        {"label": _("Role"), "fieldname": "role", "fieldtype": "Data", "width": 90},
        {"label": _("User"), "fieldname": "user", "fieldtype": "Link", "options": "User", "width": 200},
        {"label": _("Content"), "fieldname": "content", "fieldtype": "Data", "width": 600},
    ]

