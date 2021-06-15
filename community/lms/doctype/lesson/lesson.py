# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from ...md import markdown_to_html, find_macros

class Lesson(Document):
    def before_save(self):
        macros = find_macros(self.body)
        exercises = [value for name, value in macros if name == "Exercise"]

        index = 1
        for name in exercises:
            e = frappe.get_doc("Exercise", name)
            e.lesson = self.name
            e.index_ = index
            e.save()
            index += 1
        self.update_orphan_exercises(exercises)

    def update_orphan_exercises(self, active_exercises):
        """Updates the exercises that were previously part of this lesson,
        but not any more.
        """
        linked_exercises = {row['name'] for row in frappe.get_all('Exercise', {"lesson": self.name})}
        active_exercises = set(active_exercises)
        orphan_exercises = linked_exercises - active_exercises
        for name in orphan_exercises:
            ex = frappe.get_doc("Exercise", name)
            ex.lesson = None
            ex.index_ = 0
            ex.index_label = ""
            ex.save()

    def render_html(self):
        return markdown_to_html(self.body)

    def get_exercises(self):
        if not self.body:
            return []

        macros = find_macros(self.body)
        exercises = [value for name, value in macros if name == "Exercise"]
        return [frappe.get_doc("Exercise", name) for name in exercises]

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
    dynamic_content = find_macros(lesson_details.body)

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
        course_progress.save(ignore_permissions=True)

def all_dynamic_content_submitted(lesson, user):
    exercise_names = frappe.get_list("Exercise", {"lesson": lesson}, pluck="name", ignore_permissions=True)
    all_exercises_submitted = False
    query = {
        "exercise": ["in", exercise_names],
        "owner": user
    }
    if frappe.db.count("Exercise Submission", query) == len(exercise_names):
        all_exercises_submitted = True

    return all_exercises_submitted
