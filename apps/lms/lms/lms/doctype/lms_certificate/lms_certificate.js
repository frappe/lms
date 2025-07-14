// Copyright (c) 2021, FOSS United and contributors
// For license information, please see license.txt

frappe.ui.form.on("LMS Certificate", {
	onload: (frm) => {
		frm.set_query("member", function (doc) {
			return {
				filters: {
					ignore_user_type: 1,
				},
			};
		});

		frm.set_query("template", function (doc) {
			return {
				filters: {
					doc_type: "LMS Certificate",
				},
			};
		});
	},
	refresh: (frm) => {
		if (frm.doc.name)
			frm.add_web_link(
				`/api/method/frappe.utils.print_format.download_pdf?doctype=LMS+Certificate&name=${
					frm.doc.name
				}&format=${encodeURIComponent(frm.doc.template)}`,
				"See on Website"
			);
	},
});
