# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.handler import upload_file

class LessonAssignment(Document):
	pass

@frappe.whitelist()
def upload_assignment(assignment, lesson, identifier):
    lesson_work = frappe.get_doc({
        "doctype": "Lesson Assignment",
        "lesson": lesson,
        "user": frappe.session.user,
        "assignment": assignment,
        "id": identifier
    })
    lesson_work.save(ignore_permissions=True)
    return lesson_work.name

@frappe.whitelist()
def get_assignment(lesson):
    assignments = frappe.get_all("Lesson Assignment",
        {
            "lesson": lesson,
            "user": frappe.session.user
        },
        ["lesson", "user", "id", "assignment"])





