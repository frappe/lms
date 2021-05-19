# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import frappe
import unittest

class TestExercise(unittest.TestCase):
    def setUp(self):
        frappe.db.sql('delete from `tabExercise Submission`')
        frappe.db.sql('delete from `tabExercise`')

    def new_exercise(self):
        e = frappe.get_doc({
            "doctype": "Exercise",
            "name": "test-problem",
            "title": "Test Problem",
            "description": "draw a circle",
            "code": "# draw a single cicle",
            "answer": (
                "# draw a single circle\n" +
                "circle(100, 100, 50)")
        })
        e.insert()
        return e

    def test_exercise(self):
        e = self.new_exercise()
        assert e.get_user_submission() is None

    def test_exercise_submission(self):
        e = self.new_exercise()
        submission = e.submit("circle(100, 100, 50)")
        assert submission is not None

        user_submission = e.get_user_submission()
        assert user_submission is not None
        assert user_submission.name == submission.name
