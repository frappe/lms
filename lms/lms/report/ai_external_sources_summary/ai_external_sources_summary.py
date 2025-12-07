import frappe
from frappe import _
from urllib.parse import urlparse


def execute(filters=None):
    f = frappe._dict(filters or {})
    columns = [
        {"label": _("Domain"), "fieldname": "domain", "fieldtype": "Data", "width": 220},
        {"label": _("Total"), "fieldname": "total", "fieldtype": "Int", "width": 80},
        {"label": _("New"), "fieldname": "new", "fieldtype": "Int", "width": 70},
        {"label": _("Fetched"), "fieldname": "fetched", "fieldtype": "Int", "width": 90},
        {"label": _("Indexed"), "fieldname": "indexed", "fieldtype": "Int", "width": 90},
        {"label": _("Error"), "fieldname": "error", "fieldtype": "Int", "width": 80},
        {"label": _("Lessons"), "fieldname": "lessons", "fieldtype": "Int", "width": 80},
    ]

    conditions = []
    params = {}
    if f.get("course"):
        conditions.append("course = %(course)s")
        params["course"] = f.course
    where = (" where " + " and ".join(conditions)) if conditions else ""

    rows = frappe.db.sql(
        f"""
        select course, lesson, url, status
        from `tabAI External Source`
        {where}
        order by modified desc
        limit 2000
        """,
        params,
        as_dict=True,
    )
    agg = {}
    for r in rows:
        host = urlparse(r.url or "").hostname or ""
        if not host:
            host = "(unknown)"
        entry = agg.setdefault(host, {"domain": host, "total": 0, "new": 0, "fetched": 0, "indexed": 0, "error": 0, "_lessons": set()})
        entry["total"] += 1
        entry["_lessons"].add(r.lesson)
        st = (r.status or "").lower()
        if st == "new":
            entry["new"] += 1
        elif st == "fetched":
            entry["fetched"] += 1
        elif st == "indexed":
            entry["indexed"] += 1
        elif st == "error":
            entry["error"] += 1

    out = []
    for host, entry in agg.items():
        out.append({
            "domain": entry["domain"],
            "total": entry["total"],
            "new": entry["new"],
            "fetched": entry["fetched"],
            "indexed": entry["indexed"],
            "error": entry["error"],
            "lessons": len([x for x in entry["_lessons"] if x]),
        })
    out.sort(key=lambda x: (-x["total"], -x["indexed"]))
    return columns, out

