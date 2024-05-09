// Copyright (c) 2024, Frappe and contributors
// For license information, please see license.txt

frappe.ui.form.on("LMS Badge", {
	refresh: (frm) => {
		frm.events.set_fields_to_check(frm);
	},
	reference_doctype: (frm) => {
		frm.events.set_fields_to_check(frm);
	},

	set_fields_to_check: (frm) => {
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
			frm.set_df_property("field_to_check", "options", fields_to_check);
		});
	},
});
