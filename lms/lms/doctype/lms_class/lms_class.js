// Copyright (c) 2022, Frappe and contributors
// For license information, please see license.txt

frappe.ui.form.on("LMS Class", {
	onload: function (frm) {
		frm.set_query("class_student", "students", function (doc) {
			return {
				filters: {
					class_name: doc.name,
				},
			};
		});
	},

	fetch_lessons: (frm) => {
		frm.clear_table("scheduled_flow");
		frappe.call({
			method: "lms.lms.doctype.lms_class.lms_class.fetch_lessons",
			args: {
				courses: frm.doc.courses,
			},
			callback: (r) => {
				if (r.message) {
					r.message.forEach((lesson) => {
						let row = frm.add_child("scheduled_flow");
						row.lesson = lesson.name;
						row.lesson_title = lesson.title;
					});
					frm.refresh_field("scheduled_flow");
				}
			},
		});
	},
});
