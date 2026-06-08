# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from lms.lms.utils import recalculate_course_progress


class LMSCourseProgress(Document):
	def before_insert(self):
		if (
			self.member
			and self.lesson
			and frappe.db.exists("LMS Course Progress", {"member": self.member, "lesson": self.lesson})
		):
			frappe.throw(
				_("Progress is already recorded for this lesson."),
				frappe.UniqueValidationError,
			)

	def on_update(self):
		recalculate_course_progress(self.course, self.member)

	def after_delete(self):
		recalculate_course_progress(self.course, self.member)
