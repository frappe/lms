import frappe


def execute():
	frappe.reload_doc("lms", "doctype", "lms_question")
	frappe.reload_doc("lms", "doctype", "lms_quiz_question")

	questions = frappe.get_all(
		"LMS Quiz Question",
		fields=[
			"name",
			"question",
			"type",
			"multiple",
			"option_1",
			"is_correct_1",
			"explanation_1",
			"option_2",
			"is_correct_2",
			"explanation_2",
			"option_3",
			"is_correct_3",
			"explanation_3",
			"option_4",
			"is_correct_4",
			"explanation_4",
		],
	)

	for question in questions:
		doc = frappe.new_doc("LMS Question")
		doc.update(
			{
				"question": question.question,
				"type": question.type,
				"multiple": question.multiple,
			}
		)

		for num in range(1, 5):
			if question.get(f"option_{num}"):
				doc.update(
					{
						f"option_{num}": question[f"option_{num}"],
						f"is_correct_{num}": question[f"is_correct_{num}"],
						f"explanation_{num}": question[f"explanation_{num}"],
					}
				)

		doc.save()

		frappe.db.set_value("LMS Quiz Question", question.name, "question", doc.name)
