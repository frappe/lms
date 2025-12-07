import frappe
from frappe import _


def execute(filters=None):
    f = frappe._dict(filters or {})
    columns = [
        {"label": _("Course"), "fieldname": "course", "fieldtype": "Link", "options": "LMS Course", "width": 180},
        {"label": _("Lesson"), "fieldname": "lesson", "fieldtype": "Link", "options": "Course Lesson", "width": 200},
        {"label": _("Total Chunks"), "fieldname": "total_chunks", "fieldtype": "Int", "width": 110},
        {"label": _("Embedded Chunks"), "fieldname": "embedded_chunks", "fieldtype": "Int", "width": 130},
        {"label": _("Coverage %"), "fieldname": "coverage", "fieldtype": "Percent", "width": 100},
    ]

    conditions = []
    params = {}
    if f.get("course"):
        conditions.append("course = %(course)s")
        params["course"] = f.course
    where = (" where " + " and ".join(conditions)) if conditions else ""

    rows = frappe.db.sql(
        f"""
        select course, lesson,
               count(*) as total_chunks,
               sum(case when coalesce(embedding_model, '') != '' AND coalesce(embedding, '') != '' then 1 else 0 end) as embedded_chunks
        from `tabAI Knowledge Chunk`
        {where}
        group by course, lesson
        order by course, lesson
        """,
        params,
        as_dict=True,
    )
    out = []
    for r in rows:
        coverage = 0
        if r.total_chunks:
            coverage = round((r.embedded_chunks or 0) * 100.0 / r.total_chunks, 2)
        out.append(
            {
                "course": r.course,
                "lesson": r.lesson,
                "total_chunks": int(r.total_chunks or 0),
                "embedded_chunks": int(r.embedded_chunks or 0),
                "coverage": coverage,
            }
        )
    return columns, out

