# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

from lms.lms.utils import get_course_progress, get_lesson_count


class CourseChapter(Document):
	def on_update(self):
		self.recalculate_course_progress()
		self.update_lesson_count()
		frappe.enqueue(method=self.recalculate_course_progress, queue="short", timeout=300, is_async=True)

	def recalculate_course_progress(self):
		"""Recalculate course progress if a new lesson is added or removed"""
		previous_lessons = self.get_doc_before_save() and self.get_doc_before_save().as_dict().lessons
		current_lessons = self.lessons

		if previous_lessons and previous_lessons != current_lessons:
			enrolled_members = frappe.get_all("LMS Enrollment", {"course": self.course}, ["member", "name"])
			for enrollment in enrolled_members:
				new_progress = get_course_progress(self.course, enrollment.member)
				frappe.db.set_value("LMS Enrollment", enrollment.name, "progress", new_progress)

	def update_lesson_count(self):
		"""Update lesson count in the course"""
		frappe.db.set_value("LMS Course", self.course, "lessons", get_lesson_count(self.course))
