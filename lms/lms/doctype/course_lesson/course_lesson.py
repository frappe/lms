# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils.telemetry import capture
from lms.lms.utils import get_course_progress
from ...md import find_macros
import json


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
def save_progress(lesson, course):
	membership = frappe.db.exists(
		"LMS Enrollment", {"course": course, "member": frappe.session.user}
	)
	if not membership:
		return

	frappe.db.set_value("LMS Enrollment", membership, "current_lesson", lesson)

	quiz_completed = get_quiz_progress(lesson)
	if not quiz_completed:
		return 0

	if frappe.db.exists(
		"LMS Course Progress", {"lesson": lesson, "member": frappe.session.user}
	):
		return

	frappe.get_doc(
		{
			"doctype": "LMS Course Progress",
			"lesson": lesson,
			"status": "Complete",
			"member": frappe.session.user,
		}
	).save(ignore_permissions=True)

	progress = get_course_progress(course)
	# Had to get doc, as on_change doesn't trigger when you use set_value. The trigger is necesary for badge to get assigned.
	enrollment = frappe.get_doc("LMS Enrollment", membership)
	enrollment.progress = progress
	enrollment.save()
	enrollment.run_method("on_change")

	return progress


def get_quiz_progress(lesson):
	lesson_details = frappe.db.get_value(
		"Course Lesson", lesson, ["body", "content"], as_dict=1
	)
	quizzes = []

	if lesson_details.content:
		content = json.loads(lesson_details.content)

		for block in content.get("blocks"):
			if block.get("type") == "quiz":
				quizzes.append(block.get("data").get("quiz"))

	elif lesson_details.body:
		macros = find_macros(lesson_details.body)
		quizzes = [value for name, value in macros if name == "Quiz"]

	for quiz in quizzes:
		passing_percentage = frappe.db.get_value("LMS Quiz", quiz, "passing_percentage")
		if not frappe.db.exists(
			"LMS Quiz Submission",
			{
				"quiz": quiz,
				"member": frappe.session.user,
				"percentage": [">=", passing_percentage],
			},
		):
			return False
	return True


@frappe.whitelist()
def get_lesson_info(chapter):
	return frappe.db.get_value("Course Chapter", chapter, "course")
