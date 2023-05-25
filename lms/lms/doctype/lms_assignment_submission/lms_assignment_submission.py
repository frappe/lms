# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class LessonAssignment(Document):
	def validate(self):
		self.validate_duplicates()

	def validate_duplicates(self):
		if frappe.db.exists(
			"Lesson Assignment",
			{"lesson": self.lesson, "member": self.member, "name": ["!=", self.name]},
		):
			lesson_title = frappe.db.get_value("Course Lesson", self.lesson, "title")
			frappe.throw(
				_("Assignment for Lesson {0} by {1} already exists.").format(
					lesson_title, self.member_name
				)
			)


@frappe.whitelist()
def upload_assignment(assignment, lesson):
	args = {
		"doctype": "Lesson Assignment",
		"lesson": lesson,
		"member": frappe.session.user,
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
	assignment = frappe.db.get_value(
		"Lesson Assignment",
		{"lesson": lesson, "member": frappe.session.user},
		["lesson", "member", "assignment", "comments", "status"],
		as_dict=True,
	)
	assignment.file_name = frappe.db.get_value(
		"File", {"file_url": assignment.assignment}, "file_name"
	)
	return assignment


@frappe.whitelist()
def grade_assignment(name, result, comments):
	doc = frappe.get_doc("Lesson Assignment", name)
	doc.status = result
	doc.comments = comments
	doc.save(ignore_permissions=True)
