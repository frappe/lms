# Copyright (c) 2013, FOSS United and contributors
# License: MIT. See LICENSE

import frappe
from frappe.utils import rounded
from frappe import _

def execute(filters=None):
    columns, data = [], []
    columns = get_columns()
    data = get_data(filters)
    charts = get_charts(data)
    return columns, data, [], charts

def get_data(filters=None):
    summary = []
    query_filter = {}
    if filters:
        query_filter = {
            "course": filters.course
        }

    memberships = frappe.get_all(
                        "LMS Batch Membership",
                        query_filter,
                        ["name", "course", "member", "member_name"],
                        order_by="course")

    current_course = memberships[0].course
    for membership in memberships:
        if current_course != membership.course:
            current_course = membership.course

        course_details = frappe.get_doc("LMS Course", current_course)
        summary.append(frappe._dict({
            "course": course_details.name,
            "course_name": course_details.title,
            "member": membership.member,
            "member_name": membership.member_name,
            "progress": rounded(course_details.get_course_progress(membership.member))
        }))

    return summary

def get_columns():
    return [
                {
                    "fieldname": "course",
                    "fieldtype": "Link",
                    "label": _("Course"),
                    "options": "LMS Course",
                    "width": 200
                },
                {
                    "fieldname": "course_name",
                    "fieldtype": "Data",
                    "label": _("Course Name"),
                    "width": 300
                },
                {
                    "fieldname": "member",
                    "fieldtype": "Link",
                    "label": _("Member"),
                    "options": "User",
                    "width": 200
                },
                {
                    "fieldname": "member_name",
                    "fieldtype": "Data",
                    "label": _("Member Name"),
                    "width": 150
                },
                {
                    "fieldname": "progress",
                    "fieldtype": "Data",
                    "label": _("Progress (%)"),
                    "width": 120
                }
            ]

def get_charts(data):
    if not data:
        return None

    completed = 0
    less_than_hundred = 0
    less_than_seventy = 0
    less_than_forty = 0
    less_than_ten = 0

    for row in data:
        if row.progress == 100:
            completed += 1
        elif row.progress < 100 and row.progress > 70:
            less_than_hundred += 1
        elif row.progress < 70 and row.progress > 40:
            less_than_seventy += 1
        elif row.progress < 40 and row.progress > 10:
            less_than_forty += 1
        elif row.progress < 10:
            less_than_ten += 1

    charts = {
        "data": {
            "labels": ["0-10", "10-40", "40-70", "70-99", "100"],
            "datasets": [
                {
                    "name": "Progress (%)",
                    "values": [less_than_ten, less_than_forty, less_than_seventy, less_than_hundred, completed]
                }
            ]
        },
        "type": "pie",
        "colors": ["#ff0e0e", "#ff9966", "#ffcc00", "#99cc33", "#339900"]
    }
    return charts
