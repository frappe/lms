import frappe
from frappe import _


def execute(filters=None):
    f = frappe._dict(filters or {})
    columns = [
        {"label": _("Status Code"), "fieldname": "status_code", "fieldtype": "Int", "width": 110},
        {"label": _("Requests"), "fieldname": "requests", "fieldtype": "Int", "width": 100},
        {"label": _("Errors"), "fieldname": "errors", "fieldtype": "Int", "width": 90},
        {"label": _("% of Requests"), "fieldname": "pct_of_req", "fieldtype": "Percent", "width": 120},
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

    # Total requests for percentage denominator
    total_row = frappe.db.sql(f"select count(*) as c from `tabAI Proxy Log` {where}", params, as_dict=True)
    total = int((total_row[0].c if total_row else 0) or 0)

    rows = frappe.db.sql(
        f"""
        select status_code,
               count(*) as requests,
               sum(case when status='error' then 1 else 0 end) as errors
        from `tabAI Proxy Log`
        {where}
        group by status_code
        order by requests desc
        """,
        params,
        as_dict=True,
    )
    out = []
    for r in rows:
        pct = 0
        if total:
            pct = round((int(r.requests or 0) * 100.0) / total, 2)
        out.append({
            "status_code": r.status_code,
            "requests": int(r.requests or 0),
            "errors": int(r.errors or 0),
            "pct_of_req": pct,
        })
    return columns, out

