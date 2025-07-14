// Copyright (c) 2021, FOSS United and contributors
// For license information, please see license.txt

frappe.ui.form.on("LMS Course", {
	onload: function (frm) {
		frm.set_query("chapter", "chapters", function () {
			return {
				filters: {
					course: frm.doc.name,
				},
			};
		});

		frm.set_query("course", "related_courses", function () {
			return {
				filters: {
					published: true,
				},
			};
		});
	},
	refresh: (frm) => {
		frm.add_web_link(`/lms/courses/${frm.doc.name}`, "See on Website");

		if (!frm.doc.currency)
			frappe.db
				.get_single_value("LMS Settings", "default_currency")
				.then((value) => {
					frm.set_value("currency", value);
				});
	},
});
