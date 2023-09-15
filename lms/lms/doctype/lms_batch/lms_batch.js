// Copyright (c) 2022, Frappe and contributors
// For license information, please see license.txt

frappe.ui.form.on("LMS Batch", {
	onload: function (frm) {
		frm.set_query("student", "students", function (doc) {
			return {
				filters: {
					ignore_user_type: 1,
				},
			};
		});

		frm.set_query("reference_doctype", "timetable", function () {
			let doctypes = [
				"Course Lesson",
				"LMS Quiz",
				"LMS Assignment",
				"LMS Live Class",
			];
			return {
				filters: {
					name: ["in", doctypes],
				},
			};
		});
	},

	fetch_lessons: (frm) => {
		frappe.call({
			method: "lms.lms.doctype.lms_batch.lms_batch.fetch_lessons",
			args: {
				courses: frm.doc.courses,
			},
			callback: (r) => {
				if (r.message) {
					r.message.forEach((lesson) => {
						let row = frm.add_child("timetable");
						row.lesson = lesson.name;
						row.lesson_title = lesson.title;
					});
					frm.refresh_field("scheduled_flow");
				}
			},
		});
	},
});
