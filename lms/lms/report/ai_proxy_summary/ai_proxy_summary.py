import frappe
from frappe import _


def execute(filters=None):
    f = frappe._dict(filters or {})
    columns = [
        {"label": _("Course"), "fieldname": "course", "fieldtype": "Link", "options": "LMS Course", "width": 180},
        {"label": _("Lesson"), "fieldname": "lesson", "fieldtype": "Link", "options": "Course Lesson", "width": 200},
        {"label": _("Requests"), "fieldname": "requests", "fieldtype": "Int", "width": 100},
        {"label": _("Errors"), "fieldname": "errors", "fieldtype": "Int", "width": 90},
        {"label": _("Error %"), "fieldname": "error_rate", "fieldtype": "Percent", "width": 90},
        {"label": _("Avg Latency (ms)"), "fieldname": "avg_latency", "fieldtype": "Int", "width": 140},
        {"label": _("P95 Latency (ms)"), "fieldname": "p95_latency", "fieldtype": "Int", "width": 140},
    ]

    conditions = []
    params = {}

    if f.get("from_date"):
        conditions.append("time >= %(from_date)s")
        params["from_date"] = f.from_date
    if f.get("to_date"):
        conditions.append("time <= %(to_date)s")
        params["to_date"] = f.to_date
    if f.get("course"):
        conditions.append("course = %(course)s")
        params["course"] = f.course
    if f.get("lesson"):
        conditions.append("lesson = %(lesson)s")
        params["lesson"] = f.lesson

    where = (" where " + " and ".join(conditions)) if conditions else ""

    # Aggregate per course/lesson
    logs = frappe.db.sql(
        f"""
        select course, lesson,
               count(*) as requests,
               sum(case when status='error' then 1 else 0 end) as errors,
               avg(latency_ms) as avg_latency
        from `tabAI Proxy Log`
        {where}
        group by course, lesson
        order by requests desc
        """,
        params,
        as_dict=True,
    )

    # Compute P95 per group
    out = []
    for row in logs:
        p95 = frappe.db.sql(
            f"""
            select latency_ms from `tabAI Proxy Log`
            where course = %(course)s and lesson = %(lesson)s {and_clause}
            order by latency_ms
            """.format(and_clause=(" and "+" and ".join([c for c in conditions if not c.startswith("course =") and not c.startswith("lesson =")])) if conditions else ""),
            {**params, "course": row.course, "lesson": row.lesson},
            as_dict=True,
        )
        latencies = [r.latency_ms for r in p95 if r.latency_ms is not None]
        p95_val = 0
        if latencies:
            idx = int(max(0, round(0.95 * (len(latencies) - 1))))
            p95_val = latencies[idx]

        err_rate = 0
        if row.requests:
            err_rate = round((row.errors or 0) * 100.0 / row.requests, 2)

        out.append(
            {
                "course": row.course,
                "lesson": row.lesson,
                "requests": row.requests,
                "errors": row.errors,
                "error_rate": err_rate,
                "avg_latency": int(row.avg_latency or 0),
                "p95_latency": int(p95_val or 0),
            }
        )

    return columns, out

