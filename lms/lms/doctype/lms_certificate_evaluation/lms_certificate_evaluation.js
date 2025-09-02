// Copyright (c) 2022, Frappe and contributors
// For license information, please see license.txt

frappe.ui.form.on("LMS Certificate Evaluation", {
	refresh: function (frm) {
		if (!frm.is_new() && frm.doc.status == "Pass") {
			frm.add_custom_button(__("Create Certificate"), () => {
				frappe.model.open_mapped_doc({
					method: "lms.lms.doctype.lms_certificate_evaluation.lms_certificate_evaluation.create_lms_certificate",
					frm: frm,
				});
			});
		}
	},

	onload: function (frm) {
		frm.set_query("course", function (doc) {
			return {
				filters: {
					enable_certification: true,
					grant_certificate_after: "Evaluation",
				},
			};
		});

		frm.set_query("member", function (doc) {
			return {
				filters: {
					ignore_user_type: 1,
				},
			};
		});
	},
});
