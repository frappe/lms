# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

from lms.lms.utils import recalculate_course_progress


class LMSCourseProgress(Document):
	def after_delete(self):
		recalculate_course_progress(self.course, self.member)
