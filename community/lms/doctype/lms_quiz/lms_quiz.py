# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from community.lms.doctype.lesson.lesson import update_progress
import frappe
from frappe.model.document import Document
import json
from frappe import _
from ..lesson.lesson import update_progress

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
def submit(quiz, result):
    score = 0
    answer_map = {
        "is_correct_1": "option_1",
        "is_correct_2": "option_2",
        "is_correct_3": "option_3",
        "is_correct_4": "option_4"
    }
    result = json.loads(result)
    quiz_details = frappe.get_doc("LMS Quiz", quiz)

    for response in result:
        match = list(filter(lambda x: x.question == response.get("question"), quiz_details.questions))[0]
        correct_options = quiz_details.get_correct_options(match)
        correct_answers = [ match.get(answer_map[option]) for option in correct_options ]

        if response.get("answer") == correct_answers:
            response["result"] = "Right"
            score += 1
        else:
            response["result"] = "Wrong"
        response["answer"] = ("").join([ ans if idx == len(response.get("answer")) -1 else ans + ", "  for idx, ans in enumerate(response.get("answer")) ])

    frappe.get_doc({
        "doctype": "LMS Quiz Submission",
        "quiz": quiz,
        "result": result,
        "score": score
    }).save(ignore_permissions=True)
    update_progress(quiz_details.lesson)
    return score
