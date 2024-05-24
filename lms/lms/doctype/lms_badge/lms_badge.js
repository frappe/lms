// Copyright (c) 2024, Frappe and contributors
// For license information, please see license.txt

frappe.ui.form.on("LMS Badge", {
	refresh: (frm) => {
		frm.events.set_field_options(frm);

		if (frm.doc.event == "Auto Assign") {
			add_assign_button(frm);
		}
	},
	reference_doctype: (frm) => {
		frm.events.set_field_options(frm);
	},

	set_field_options: (frm) => {
		const reference_doctype = frm.doc.reference_doctype;
		if (!reference_doctype) return;

		frappe.model.with_doctype(reference_doctype, () => {
			const map_for_options = (df) => ({
				label: df.label,
				value: df.fieldname,
			});
			const fields = frappe.meta
				.get_docfields(frm.doc.reference_doctype)
				.filter(frappe.model.is_value_type);

			const fields_to_check = fields.map(map_for_options);

			const user_fields = fields
				.filter(
					(df) =>
						(df.fieldtype === "Link" && df.options === "User") ||
						df.fieldtype === "Data"
				)
				.map(map_for_options)
				.concat([
					{ label: __("Owner"), value: "owner" },
					{ label: __("Modified By"), value: "modified_by" },
				]);

			frm.set_df_property("field_to_check", "options", fields_to_check);
			frm.set_df_property("user_field", "options", user_fields);
		});
	},
});

const add_assign_button = (frm) => {
	frm.add_custom_button(__("Assign"), function () {
		frappe.call({
			method: "lms.lms.doctype.lms_badge.lms_badge.assign_badge",
			args: {
				badge: frm.doc,
			},
			callback: function (r) {
				if (r.message) {
					frappe.msgprint(r.message);
				}
			},
		});
	});
};
