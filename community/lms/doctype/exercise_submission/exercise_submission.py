# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from ..lesson.lesson import update_progress

class ExerciseSubmission(Document):

    def after_insert(self):
        course_details = frappe.get_doc("LMS Course", self.course)
        if not (course_details.is_mentor(frappe.session.user) or frappe.flags.in_test):
            update_progress(self.lesson)
