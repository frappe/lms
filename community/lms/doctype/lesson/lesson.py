# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from ...section_parser import SectionParser

class Lesson(Document):
    def before_save(self):
        sections = SectionParser().parse(self.body or "")
        self.sections = [self.make_lms_section(i, s) for i, s in enumerate(sections)]
        for s in self.sections:
            if s.type == "exercise":
                e = s.get_exercise()
                e.lesson = self.name
                e.save()

    def get_sections(self):
        return sorted(self.get('sections'), key=lambda s: s.index)

    def make_lms_section(self, index, section):
            s = frappe.new_doc('LMS Section', parent_doc=self, parentfield='sections')
            s.type = section.type
            s.id = section.id
            s.label = section.label
            s.contents = section.contents
            s.index = index
            return s

    def get_next(self):
        """Returns the number for the next lesson.

        The return value would be like 1.2, 2.1 etc.
        It will be None if there is no next lesson.
        """


    def get_prev(self):
        """Returns the number for the prev lesson.

        The return value would be like 1.2, 2.1 etc.
        It will be None if there is no next lesson.
        """

    def get_progress(self):
        return frappe.db.get_value("LMS Course Progress", {"lesson": self.name, "owner": frappe.session.user}, "status")

    def get_slugified_class(self):
        if self.get_progress():
            return ("").join([ s for s in self.get_progress().lower().split() ])
        return

@frappe.whitelist()
def save_progress(lesson, batch):
    if not frappe.db.exists("LMS Batch Membership",
            {
                "member": frappe.session.user,
                "batch": batch
            }):
        return
    if frappe.db.exists("LMS Course Progress",
            {
                "lesson": lesson,
                "owner": frappe.session.user
            }):
        return

    lesson_details = frappe.get_doc("Lesson", lesson)
    dynamic_content = frappe.db.count("LMS Section",
                        filters={
                            "type": ["not in", ["example", "text"]],
                            "parent": lesson_details.name
                        })

    status = "Complete"
    if dynamic_content:
        status = "Partially Complete"

    frappe.get_doc({
        "doctype": "LMS Course Progress",
        "lesson": lesson_details.name,
        "status": status
    }).save(ignore_permissions=True)

def update_progress(lesson):
    user = frappe.session.user
    if not all_dynamic_content_submitted(lesson, user):
        return
    if frappe.db.exists("LMS Course Progress", {"lesson": lesson, "owner": user}):
        course_progress = frappe.get_doc("LMS Course Progress", {"lesson": lesson, "owner": user})
        course_progress.status = "Complete"
        course_progress.save()

def all_dynamic_content_submitted(lesson, user):
    exercise_names = frappe.get_list("Exercise", {"lesson": lesson}, ["name"], pluck="name")
    all_exercises_submitted = False
    print(exercise_names)
    query = {
        "exercise": ["in", exercise_names],
        "owner": user
    }
    if frappe.db.count("Exercise Submission", query) == len(exercise_names):
        all_exercises_submitted = True

    return all_exercises_submitted
