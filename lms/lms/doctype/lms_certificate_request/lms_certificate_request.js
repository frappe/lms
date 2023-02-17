// Copyright (c) 2022, Frappe and contributors
// For license information, please see license.txt

frappe.ui.form.on("LMS Certificate Request", {
	refresh: function (frm) {
		if (!frm.is_new()) {
			frm.add_custom_button(
				__("Create LMS Certificate Evaluation"),
				() => {
					frappe.model.open_mapped_doc({
						method: "lms.lms.doctype.lms_certificate_request.lms_certificate_request.create_lms_certificate_evaluation",
						frm: frm,
					});
				}
			);
		}
	},

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
