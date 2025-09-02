import frappe


def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    return columns, data


def get_columns():
    return [
        {
            "label": "Batch Title",
            "fieldname": "batch_title",
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
            "label": "Start Date",
            "fieldname": "start_date",
            "fieldtype": "Date",
            "width": 120,
        },
        {
            "label": "End Date",
            "fieldname": "end_date",
            "fieldtype": "Date",
            "width": 120,
        },
        {
            "label": "Published",
            "fieldname": "published",
            "fieldtype": "Check",
            "width": 100,
        },
        {
            "label": "Certification",
            "fieldname": "certification",
            "fieldtype": "Check",
            "width": 120,
        },
        {
            "label": "Category",
            "fieldname": "category",
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "label": "Users Invited",
            "fieldname": "users_invited",
            "fieldtype": "Int",
            "width": 120,
        },
        {
            "label": "Present Count",
            "fieldname": "present_count",
            "fieldtype": "Int",
            "width": 120,
        },
        {
            "label": "Absent Count",
            "fieldname": "absent_count",
            "fieldtype": "Int",
            "width": 120,
        },
        {
            "label": "Invited Users List",
            "fieldname": "invited_users",
            "fieldtype": "Data",
            "width": 300,
        },
        {
            "label": "Attended Users List",
            "fieldname": "attended_users",
            "fieldtype": "Data",
            "width": 300,
        },
    ]


def get_conditions(filters):
    conditions = []

    if filters.get("from_date") and filters.get("to_date"):
        conditions.append("b.start_date BETWEEN %(from_date)s AND %(to_date)s")
    if filters.get("category"):
        conditions.append("b.category = %(category)s")
    if filters.get("published") is not None:
        conditions.append("b.published = %(published)s")
    if filters.get("certification") is not None:
        conditions.append("b.certification = %(certification)s")

    return " AND ".join(conditions) if conditions else "1=1"


def get_data(filters):
    conditions = get_conditions(filters)

    query = f"""
        SELECT
            b.title AS batch_title,
            b.name AS batch_id,
            b.start_date,
            b.end_date,
            b.published,
            b.certification,
            b.category,
            COUNT(DISTINCT be.name) AS users_invited,
            COUNT(DISTINCT CASE WHEN lme.presence_status = 'Present' THEN be.member END) AS present_count,
            COUNT(DISTINCT CASE WHEN lme.presence_status = 'Absent' THEN be.member END) AS absent_count,
            GROUP_CONCAT(DISTINCT be.member_name SEPARATOR ', ') AS invited_users,
            GROUP_CONCAT(DISTINCT CASE WHEN lme.presence_status = 'Present' THEN be.member_name END SEPARATOR ', ') AS attended_users
        FROM `tabLMS Batch` b
        LEFT JOIN `tabLMS Batch Enrollment` be ON be.batch = b.name
        LEFT JOIN `tabLMS Enrollment` lme ON lme.member = be.member
        WHERE {conditions}
        GROUP BY b.name
    """
    return frappe.db.sql(query, filters, as_dict=True)
