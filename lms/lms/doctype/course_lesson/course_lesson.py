# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils.telemetry import capture
from lms.lms.utils import get_course_progress
from ...md import find_macros


class CourseLesson(Document):
	def validate(self):
		# self.check_and_create_folder()
		self.validate_quiz_id()

	def validate_quiz_id(self):
		if self.quiz_id and not frappe.db.exists("LMS Quiz", self.quiz_id):
			frappe.throw(_("Invalid Quiz ID"))

	def on_update(self):
		dynamic_documents = ["Exercise", "Quiz"]
		for section in dynamic_documents:
			self.update_lesson_name_in_document(section)

	def after_insert(self):
		capture("lesson_created", "lms")

	def update_lesson_name_in_document(self, section):
		doctype_map = {"Exercise": "LMS Exercise", "Quiz": "LMS Quiz"}
		macros = find_macros(self.body)
		documents = [value for name, value in macros if name == section]
		index = 1
		for name in documents:
			e = frappe.get_doc(doctype_map[section], name)
			e.lesson = self.name
			e.index_ = index
			e.course = self.course
			e.save(ignore_permissions=True)
			index += 1
		self.update_orphan_documents(doctype_map[section], documents)

	def update_orphan_documents(self, doctype, documents):
		"""Updates the documents that were previously part of this lesson,
		but not any more.
		"""
		linked_documents = {
			row["name"] for row in frappe.get_all(doctype, {"lesson": self.name})
		}
		active_documents = set(documents)
		orphan_documents = linked_documents - active_documents
		for name in orphan_documents:
			ex = frappe.get_doc(doctype, name)
			ex.lesson = None
			ex.course = None
			ex.index_ = 0
			ex.index_label = ""
			ex.save(ignore_permissions=True)

	def check_and_create_folder(self):
		args = {
			"doctype": "File",
			"is_folder": True,
			"file_name": f"{self.name} {self.course}",
		}
		if not frappe.db.exists(args):
			folder = frappe.get_doc(args)
			folder.save(ignore_permissions=True)

	def get_exercises(self):
		if not self.body:
			return []

		macros = find_macros(self.body)
		exercises = [value for name, value in macros if name == "Exercise"]
		return [frappe.get_doc("LMS Exercise", name) for name in exercises]

	def get_progress(self):
		return frappe.db.get_value(
			"LMS Course Progress", {"lesson": self.name, "owner": frappe.session.user}, "status"
		)

	def get_slugified_class(self):
		if self.get_progress():
			return ("").join([s for s in self.get_progress().lower().split()])
		return


@frappe.whitelist()
def save_progress(lesson, course, status):
	membership = frappe.db.exists(
		"LMS Enrollment", {"member": frappe.session.user, "course": course}
	)
	if not membership:
		return 0

	body = frappe.db.get_value("Course Lesson", lesson, "body")
	macros = find_macros(body)
	quizzes = [value for name, value in macros if name == "Quiz"]

	for quiz in quizzes:
		passing_percentage = frappe.db.get_value("LMS Quiz", quiz, "passing_percentage")
		if not frappe.db.exists(
			"LMS Quiz Submission",
			{
				"quiz": quiz,
				"owner": frappe.session.user,
				"percentage": [">=", passing_percentage],
			},
		):
			return 0

	filters = {"lesson": lesson, "owner": frappe.session.user, "course": course}
	if frappe.db.exists("LMS Course Progress", filters):
		doc = frappe.get_doc("LMS Course Progress", filters)
		doc.status = status
		doc.save(ignore_permissions=True)
	else:
		frappe.get_doc(
			{
				"doctype": "LMS Course Progress",
				"lesson": lesson,
				"status": status,
				"member": frappe.session.user,
			}
		).save(ignore_permissions=True)

	progress = get_course_progress(course)
	frappe.db.set_value("LMS Enrollment", membership, "progress", progress)
	return progress


@frappe.whitelist()
def get_lesson_info(chapter):
	return frappe.db.get_value("Course Chapter", chapter, "course")
