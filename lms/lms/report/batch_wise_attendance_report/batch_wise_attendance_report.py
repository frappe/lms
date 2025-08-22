import frappe

def execute(filters=None):
    columns = [
        {"label": "Batch Name", "fieldname": "batch_name", "fieldtype": "Data", "width": 200},
        {"label": "Batch ID", "fieldname": "batch_id", "fieldtype": "Data", "width": 120},
        {"label": "Member ID", "fieldname": "member_id", "fieldtype": "Data", "width": 120},
        {"label": "Member Name", "fieldname": "member_name", "fieldtype": "Data", "width": 200},
        {"label": "Attendance Status", "fieldname": "status", "fieldtype": "Data", "width": 150},
    ]

    conditions = []
    values = {}

    # --- Filters ---
    if filters.get("batch_id"):
        conditions.append("b.name = %(batch_id)s")
        values["batch_id"] = filters["batch_id"]

    if filters.get("batch_name"):
        conditions.append("b.title LIKE %(batch_name)s")
        values["batch_name"] = f"%{filters['batch_name']}%"

    if filters.get("date"):
        conditions.append("a.date = %(date)s")
        values["date"] = filters["date"]

    if filters.get("status"):
        conditions.append("a.status = %(status)s")
        values["status"] = filters["status"]

    if filters.get("member_id"):
        conditions.append("e.member = %(member_id)s")
        values["member_id"] = filters["member_id"]

    if filters.get("member_name"):
        conditions.append("e.member_name LIKE %(member_name)s")
        values["member_name"] = f"%{filters['member_name']}%"

    condition_str = " AND ".join(conditions) if conditions else "1=1"

    # --- Main Query ---
    data = frappe.db.sql(f"""
        SELECT 
            b.title AS batch_name,
            b.name AS batch_id,
            e.member AS member_id,
            e.member_name AS member_name,
            COALESCE(a.status, 'Not Marked') AS status
        FROM `tabLMS Batch` b
        JOIN `tabLMS Batch Enrollment` e ON e.batch = b.name
        LEFT JOIN `tabLMS Attendance` a 
            ON a.batch = b.name AND a.member = e.member
            {f"AND a.date = %(date)s" if filters.get("date") else ""}
        WHERE {condition_str}
        ORDER BY b.start_date, e.member_name
    """, values, as_dict=True)

    # --- Summary Section ---
    total_users = len(data)
    present_count = sum(1 for d in data if d.status == "Present")
    absent_count = sum(1 for d in data if d.status == "Absent")

    summary = [
        {"label": "Total Users Enrolled", "value": total_users, "indicator": "Blue"},
        {"label": "Total Present", "value": present_count, "indicator": "Green"},
        {"label": "Total Absent", "value": absent_count, "indicator": "Red"},
    ]

    # Optional custom note from filters
    if filters.get("note"):
        summary.append({"label": "Note", "value": filters["note"], "indicator": "Gray"})

    return columns, data, None, summary
