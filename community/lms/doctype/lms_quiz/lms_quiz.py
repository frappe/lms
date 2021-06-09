# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import json

class LMSQuiz(Document):
    pass

@frappe.whitelist()
def submit(quiz, result):
    score = 0
    result = json.loads(result)
    quiz_details = frappe.get_doc("LMS Quiz", quiz)
    print(result, type(result))
    for response in result:
        match = list(filter(lambda x: x.question == response.get("question"), quiz_details.questions))[0]
        response["users_response"] = ("").join([ ans  for ans in response.get("answer") ]).replace(" ",  ", ")
        del response["answer"]
        print(response.get("users_response"), match.answer)
        if response.get("users_response") == match.answer:
            response["result"] = "Right"
            score += 1
        else:
            response["result"] = "Wrong"

    frappe.get_doc({
        "doctype": "LMS Quiz Submission",
        "quiz": quiz,
        "result": result,
        "score": score
    }).save()
    return score


