// Copyright (c) 2022, Frappe and contributors
// For license information, please see license.txt

frappe.ui.form.on("LMS Class", {
	onload: function (frm) {
		frm.set_query("student", "students", function (doc) {
			return {
				filters: {
					ignore_user_type: 1,
				},
			};
		});
	},
});
