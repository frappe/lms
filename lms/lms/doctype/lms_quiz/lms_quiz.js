// Copyright (c) 2021, FOSS United and contributors
// For license information, please see license.txt

frappe.ui.form.on("LMS Quiz", {
	// refresh: function(frm) {
	// }
});

frappe.ui.form.on("LMS Quiz Question", {
	marks: function (frm) {
		total_marks = 0;
		frm.doc.questions.forEach((question) => {
			total_marks += question.marks;
		});
		frm.doc.total_marks = total_marks;
	},
});
