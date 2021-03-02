// Copyright (c) 2021, Frappe and contributors
// For license information, please see license.txt

frappe.ui.form.on('Community Course', {
	before_submit: function (form) {
		if (!form.doc.route) {
			form.doc.route = "/courses/" + form.doc.name
		}
	}
});
