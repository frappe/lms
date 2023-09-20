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
			let doctypes = ["Course Lesson", "LMS Quiz", "LMS Assignment"];
			return {
				filters: {
					name: ["in", doctypes],
				},
			};
		});
	},

	timetable_template: function (frm) {
		if (frm.doc.timetable_template) {
			frm.clear_table("timetable");
			frm.refresh_fields();

			frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "LMS Batch Timetable",
					parent: "LMS Timetable Template",
					fields: [
						"reference_doctype",
						"reference_docname",
						"date",
						"start_time",
						"end_time",
					],
					filters: {
						parent: frm.doc.timetable_template,
					},
					order_by: "idx",
				},
				callback: (data) => {
					add_timetable_rows(frm, data.message);
				},
			});
		}
	},
});

const add_timetable_rows = (frm, timetable) => {
	timetable.forEach((row) => {
		let child = frm.add_child("timetable");
		child.reference_doctype = row.reference_doctype;
		child.reference_docname = row.reference_docname;
		child.date = row.date;
		child.start_time = row.start_time;
		child.end_time = row.end_time;
	});
	frm.refresh_field("timetable");
	frm.save();
};
