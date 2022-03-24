# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.handler import upload_file

class LessonAssignment(Document):
	pass

@frappe.whitelist()
def upload_assignment(assignment, lesson, identifier):
    args = {
        "doctype": "Lesson Assignment",
        "lesson": lesson,
        "user": frappe.session.user,
        "id": identifier
    }
    if frappe.db.exists(args):
        del args["doctype"]
        frappe.db.set_value("Lesson Assignment", args, "assignment", assignment)
    else:
        args.update({"assignment": assignment})
        lesson_work = frappe.get_doc(args)
        lesson_work.save(ignore_permissions=True)

@frappe.whitelist()
def get_assignment(lesson):
    assignments = frappe.get_all("Lesson Assignment",
        {
            "lesson": lesson,
            "user": frappe.session.user
        },
        ["lesson", "user", "id", "assignment"])
    if len(assignments):
        for assignment in assignments:
            assignment.file_name = frappe.db.get_value("File", {"file_url": assignment.assignment}, "file_name")
    return assignments





