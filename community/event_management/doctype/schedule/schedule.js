// Copyright (c) 2021, FOSS United and contributors
// For license information, please see license.txt

frappe.ui.form.on('Schedule', {
	onload: function (frm) {
		frm.set_query('talk', function (doc) {
			return {
				filters: {
					"status": "Approved",
				}
			};
		});
	}
});
