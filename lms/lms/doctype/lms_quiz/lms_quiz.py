# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import json
from frappe import _

class LMSQuiz(Document):
    def validate(self):
        self.validate_correct_answers()

    def validate_correct_answers(self):
        for question in self.questions:
            correct_options = self.get_correct_options(question)

            if len(correct_options) > 1:
                question.multiple = 1

            if not len(correct_options):
                frappe.throw(_("At least one answer must be correct for this question: {0}").format(frappe.bold(question.question)))

    def get_correct_options(self, question):
        correct_option_fields = ["is_correct_1", "is_correct_2", "is_correct_3", "is_correct_4"]
        return list(filter(lambda x: question.get(x) == 1, correct_option_fields))

    def get_last_submission_details(self):
        """Returns the latest submission for this user.
        """
        user = frappe.session.user
        if not user or user == "Guest":
            return

        result = frappe.get_all('LMS Quiz Submission',
            fields="*",
            filters={
                "owner": user,
                "quiz": self.name
            },
            order_by="creation desc",
            page_length=1)

        if result:
            return result[0]

@frappe.whitelist()
def quiz_summary(quiz, results):
    score = 0
    results = results and json.loads(results)

    for result in results:
        correct = result["is_correct"][0]
        result["question"] = frappe.db.get_value("LMS Quiz Question",
            {"parent": quiz,
             "idx": result["question_index"]},
            ["question"])

        for point in result["is_correct"]:
            correct = correct and point

        result["result"] = "Right" if correct else "Wrong"
        score += correct

        del result["is_correct"]
        del result["question_index"]

    frappe.get_doc({
        "doctype": "LMS Quiz Submission",
        "quiz": quiz,
        "result": results,
        "score": score,
        "member": frappe.session.user
    }).save(ignore_permissions=True)

    return score
