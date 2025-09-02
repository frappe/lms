import frappe


def execute(filters=None):
    columns = [
        {
            "label": "Batch Name",
            "fieldname": "batch_name",
            "fieldtype": "Data",
            "width": 200,
        },
        {
            "label": "Batch ID",
            "fieldname": "batch_id",
            "fieldtype": "Link",
            "options": "LMS Batch",
            "width": 150,
        },
        {
            "label": "Member ID",
            "fieldname": "member_id",
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "label": "Member Name",
            "fieldname": "member_name",
            "fieldtype": "Data",
            "width": 200,
        },
        {
            "label": "Attendance Status",
            "fieldname": "status",
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "label": "Batch Summary",
            "fieldname": "batch_summary",
            "fieldtype": "Data",
            "width": 300,
        },
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

    if filters.get("status"):
        conditions.append("le.presence_status = %(status)s")
        values["status"] = filters["status"]

    if filters.get("member_id"):
        conditions.append("e.member = %(member_id)s")
        values["member_id"] = filters["member_id"]

    if filters.get("member_name"):
        conditions.append("e.member_name LIKE %(member_name)s")
        values["member_name"] = f"%{filters['member_name']}%"

    condition_str = " AND ".join(conditions) if conditions else "1=1"

    # --- Main Query ---
    data = frappe.db.sql(
        f"""
        SELECT 
            b.title AS batch_name,
            b.name AS batch_id,
            e.member AS member_id,
            e.member_name AS member_name,
            COALESCE(le.presence_status, 'Not Marked') AS status
        FROM `tabLMS Batch` b
        JOIN `tabLMS Batch Enrollment` e ON e.batch = b.name
        LEFT JOIN `tabLMS Enrollment` le ON le.member = e.member
        WHERE {condition_str}
        ORDER BY b.start_date, e.member_name
    """,
        values,
        as_dict=True,
    )

    # --- Batch-wise summary calculation ---
    batch_summary_map = {}

    # Group rows by batch_id
    from collections import defaultdict

    grouped = defaultdict(list)
    for d in data:
        grouped[d["batch_id"]].append(d)

    # Calculate summary for each batch
    for batch_id, rows in grouped.items():
        total_users = len(rows)
        present_count = sum(1 for r in rows if r["status"] == "Present")
        absent_count = sum(1 for r in rows if r["status"] == "Absent")

        batch_summary_map[batch_id] = (
            f"Total Enrolled: {total_users}, Present: {present_count}, Absent: {absent_count}"
        )

    # Add batch summary to each row
    for row in data:
        row["batch_summary"] = batch_summary_map.get(row["batch_id"], "")

    return columns, data, None, None
