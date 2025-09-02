import frappe
import requests
from frappe.utils import formatdate


API_URL = (
    frappe.conf.get("BASE_URL")
    + "/api/method/campus_erp.api.employee.fetch_employee_details.get_employee_by_username"
)


def execute(filters=None):
    columns = [
        {
            "label": "Employee ID",
            "fieldname": "employee_id",
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "label": "Employee Name",
            "fieldname": "employee_name",
            "fieldtype": "Data",
            "width": 200,
        },
        {
            "label": "Department",
            "fieldname": "department",
            "fieldtype": "Data",
            "width": 200,
        },
        {
            "label": "Designation",
            "fieldname": "designation",
            "fieldtype": "Data",
            "width": 150,
        },
        {"label": "Month", "fieldname": "month", "fieldtype": "Data", "width": 120},
        {
            "label": "Total Trainings Offered",
            "fieldname": "total_offered",
            "fieldtype": "Int",
            "width": 180,
        },
        {
            "label": "Trainings Attended",
            "fieldname": "attended",
            "fieldtype": "Int",
            "width": 160,
        },
        {
            "label": "Attendance %",
            "fieldname": "attendance_percent",
            "fieldtype": "Percent",
            "width": 150,
        },
    ]

    if not filters:
        filters = {}

    values = {}
    conditions = []

    # Handle filters
    if filters.get("month"):
        values["month_label"] = filters["month"]
    else:
        values["month_label"] = formatdate(frappe.utils.nowdate(), "MMMM yyyy")

    if filters.get("employee_id"):
        conditions.append("be.member = %(employee_id)s")
        values["employee_id"] = filters["employee_id"]

    if filters.get("employee_name"):
        conditions.append("be.member_name LIKE %(employee_name)s")
        values["employee_name"] = f"%{filters['employee_name']}%"

    condition_str = " AND ".join(conditions) if conditions else "1=1"

    # Fetch data: use tabLMS Batch Enrollment and tabLMS Enrollment
    query = f"""
        SELECT
            be.member AS employee_id,
            be.member_name AS employee_name,
            COUNT(DISTINCT be.batch) AS total_offered,
            SUM(CASE WHEN le.presence_status = 'Present' THEN 1 ELSE 0 END) AS attended,
            %(month_label)s AS month
        FROM `tabLMS Batch Enrollment` be
        LEFT JOIN `tabLMS Enrollment` le ON le.member = be.member
        WHERE {condition_str}
        GROUP BY be.member, be.member_name
    """

    data = frappe.db.sql(query, values, as_dict=True)

    # Fetch department/designation via external API
    for row in data:
        row["department"] = "-"
        row["designation"] = "-"
        try:
            res = requests.post(
                API_URL, params={"username": row["employee_id"]}, timeout=5
            )
            if res.status_code == 200:
                payload = res.json()
                if payload.get("message", {}).get("status") == "success":
                    emp = payload["message"]["data"]
                    row["employee_name"] = (
                        emp.get("employee_name") or row["employee_name"]
                    )
                    row["department"] = emp.get("department") or "-"
                    row["designation"] = emp.get("designation") or "-"
        except Exception as e:
            frappe.log_error(message=str(e), title="Employee API Fetch Failed")

        # Calculate percentage
        total = row.get("total_offered") or 0
        attended = row.get("attended") or 0
        row["attendance_percent"] = (attended / total * 100) if total else 0

    return columns, data
