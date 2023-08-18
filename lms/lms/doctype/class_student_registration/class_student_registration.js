// Copyright (c) 2023, Frappe and contributors
// For license information, please see license.txt

frappe.ui.form.on("Class Student Registration", {
	onload: function (frm) {
		frm.set_query("member", function (doc) {
			return {
				filters: {
					ignore_user_type: 1,
				},
			};
		});
	},
});
