// Copyright (c) 2024, Frappe and contributors
// For license information, please see license.txt

frappe.ui.form.on("LMS Badge Assignment", {
	refresh(frm) {
		frm.set_query("member", function (doc) {
			return {
				filters: {
					ignore_user_type: 1,
				},
			};
		});

		if (frm.doc.name)
			frm.add_web_link(
				`/badges/${frm.doc.badge}/${frm.doc.member}`,
				"See on Website"
			);
	},
});
