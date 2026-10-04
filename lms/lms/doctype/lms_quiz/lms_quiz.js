// Copyright (c) 2021, FOSS United and contributors
// For license information, please see license.txt

frappe.ui.form.on("LMS Quiz", {
	limit_questions_to: set_total_marks,
	shuffle_questions: set_total_marks,
});

frappe.ui.form.on("LMS Quiz Question", {
	marks: set_total_marks,
	questions_add: set_total_marks,
	questions_remove: set_total_marks,
});

// Mirrors LMSQuiz.calculate_total_marks so the field is right before save. The
// limit only counts while questions are shuffled; validate clears it otherwise.
function set_total_marks(frm) {
	const limit = frm.doc.shuffle_questions
		? cint(frm.doc.limit_questions_to)
		: 0;
	const questions = frm.doc.questions || [];
	const counted = limit ? questions.slice(0, limit) : questions;
	const total_marks = counted.reduce(
		(total, question) => total + cint(question.marks),
		0
	);
	frm.set_value("total_marks", total_marks);
}
