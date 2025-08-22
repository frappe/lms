# import frappe
# from frappe.utils import get_first_day, get_last_day, formatdate


# def execute(filters=None):
#     columns = [
#         {
#             "label": "Employee ID",
#             "fieldname": "employee_id",
#             "fieldtype": "Data",
#             "width": 120,
#         },
#         {
#             "label": "Employee Name",
#             "fieldname": "employee_name",
#             "fieldtype": "Data",
#             "width": 200,
#         },
#         {
#             "label": "Department",
#             "fieldname": "department",
#             "fieldtype": "Data",
#             "width": 200,
#         },
#         {
#             "label": "Designation",
#             "fieldname": "designation",
#             "fieldtype": "Data",
#             "width": 150,
#         },
#         {"label": "Month", "fieldname": "month", "fieldtype": "Data", "width": 120},
#         {
#             "label": "Total Trainings Offered",
#             "fieldname": "total_offered",
#             "fieldtype": "Int",
#             "width": 180,
#         },
#         {
#             "label": "Trainings Attended",
#             "fieldname": "attended",
#             "fieldtype": "Int",
#             "width": 160,
#         },
#         {
#             "label": "Attendance %",
#             "fieldname": "attendance_percent",
#             "fieldtype": "Percent",
#             "width": 150,
#         },
#     ]

#     conditions = []
#     values = {}

#     # --- Filters ---
#     if filters.get("month"):
#         first_day = get_first_day(filters["month"])
#         last_day = get_last_day(filters["month"])
#         conditions.append("a.date BETWEEN %(first_day)s AND %(last_day)s")
#         values["first_day"] = first_day
#         values["last_day"] = last_day

#     if filters.get("employee_id"):
#         conditions.append("e.member = %(employee_id)s")
#         values["employee_id"] = filters["employee_id"]

#     if filters.get("employee_name"):
#         conditions.append("e.member_name LIKE %(employee_name)s")
#         values["employee_name"] = f"%{filters['employee_name']}%"

#     condition_str = " AND ".join(conditions) if conditions else "1=1"

#     # --- Query LMS Attendance ---
#     data = frappe.db.sql(
#         f"""
#         SELECT
#             e.member AS employee_id,
#             e.member_name AS employee_name,
#             COUNT(DISTINCT e.batch) AS total_offered,
#             SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS attended,
#             %(month)s AS month
#         FROM `tabLMS Batch Enrollment` e
#         LEFT JOIN `tabLMS Attendance` a
#             ON a.batch = e.batch AND a.member = e.member
#         WHERE {condition_str}
#         GROUP BY e.member, e.member_name
#     """,
#         {
#             **values,
#             "month": filters.get("month")
#             or formatdate(frappe.utils.nowdate(), "MMMM yyyy"),
#         },
#         as_dict=True,
#     )

#     # --- Enrich with Employee Details via API ---
#     for row in data:
#         try:
#             emp = frappe.call(
#                 "campus_erp.campus_erp.api.employee.fetch_employee_details.get_employee_by_username",
#                 username=row["employee_id"],
#             )
#             if emp and emp.get("message", {}).get("status") == "success":
#                 emp_data = emp["message"]["data"]
#                 row["department"] = emp_data.get("department")
#                 row["designation"] = emp_data.get("designation")
#         except Exception:
#             row["department"] = "-"
#             row["designation"] = "-"

#         total = row.get("total_offered") or 0
#         attended = row.get("attended") or 0
#         row["attendance_percent"] = (attended / total * 100) if total else 0

#     return columns, data

import frappe
import requests
from frappe.utils import get_first_day, get_last_day, formatdate

API_URL = "http://192.168.54.98:8000/api/method/campus_erp.campus_erp.api.employee.fetch_employee_details.get_employee_by_username"


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

    conditions = []
    values = {}

    # --- Filters ---
    if filters.get("month"):
        first_day = get_first_day(filters["month"])
        last_day = get_last_day(filters["month"])
        conditions.append("a.date BETWEEN %(first_day)s AND %(last_day)s")
        values["first_day"] = first_day
        values["last_day"] = last_day

    if filters.get("employee_id"):
        conditions.append("e.member = %(employee_id)s")
        values["employee_id"] = filters["employee_id"]

    if filters.get("employee_name"):
        conditions.append("e.member_name LIKE %(employee_name)s")
        values["employee_name"] = f"%{filters['employee_name']}%"

    condition_str = " AND ".join(conditions) if conditions else "1=1"

    # --- Query LMS Attendance ---
    data = frappe.db.sql(
        f"""
        SELECT
            e.member AS employee_id,
            e.member_name AS employee_name,
            COUNT(DISTINCT e.batch) AS total_offered,
            SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS attended,
            %(month)s AS month
        FROM `tabLMS Batch Enrollment` e
        LEFT JOIN `tabLMS Attendance` a 
            ON a.batch = e.batch AND a.member = e.member
        WHERE {condition_str}
        GROUP BY e.member, e.member_name
    """,
        {
            **values,
            "month": filters.get("month")
            or formatdate(frappe.utils.nowdate(), "MMMM yyyy"),
        },
        as_dict=True,
    )

    # --- Fetch employee details from external API ---
    for row in data:
        row["department"] = "-"
        row["designation"] = "-"

        try:
            res = requests.get(
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

        # --- Attendance % ---
        total = row.get("total_offered") or 0
        attended = row.get("attended") or 0
        row["attendance_percent"] = (attended / total * 100) if total else 0

    return columns, data
