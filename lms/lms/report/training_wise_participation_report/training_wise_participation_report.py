import frappe

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    return columns, data


def get_columns():
    return [
        {"label": "Training Title", "fieldname": "training_title", "fieldtype": "Data", "width": 250},
        {"label": "Training ID", "fieldname": "course_id", "fieldtype": "Data", "width": 180},
        {"label": "Total Users Enrolled", "fieldname": "total_users_enrolled", "fieldtype": "Int", "width": 180},
        {"label": "Total Users Completed", "fieldname": "total_users_completed", "fieldtype": "Int", "width": 180},
        {"label": "Completion Percentage (%)", "fieldname": "completion_percentage", "fieldtype": "Percent", "width": 200},
    ]


def get_data(filters):
    conditions = []
    values = {}

    if filters.get("training_id"):
        conditions.append("c.name = %(training_id)s")
        values["training_id"] = filters["training_id"]

    if filters.get("training_title"):
        conditions.append("c.title LIKE %(training_title)s")
        values["training_title"] = f"%{filters['training_title']}%"

    where_clause = " AND ".join(conditions)
    if where_clause:
        where_clause = "WHERE " + where_clause

    query = f"""
        SELECT
            c.name AS course_id,
            c.title AS training_title,
            COUNT(e.name) AS total_users_enrolled,
            SUM(CASE WHEN e.progress >= 100 THEN 1 ELSE 0 END) AS total_users_completed,
            ROUND(
                (SUM(CASE WHEN e.progress >= 100 THEN 1 ELSE 0 END) * 100.0) / NULLIF(COUNT(e.name),0),
                2
            ) AS completion_percentage
        FROM `tabLMS Course` c
        LEFT JOIN `tabLMS Enrollment` e ON e.course = c.name
        {where_clause}
        GROUP BY c.name, c.title
        ORDER BY c.title
    """

    return frappe.db.sql(query, values, as_dict=True)
