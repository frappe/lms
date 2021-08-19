// Copyright (c) 2021, FOSS United and contributors
// For license information, please see license.txt

frappe.ui.form.on('Speaker', {
	onload: function (frm) {
		frm.set_query('user', function (doc) {
			return {
				filters: {
					"ignore_user_type": 1,
				}
			};
		});
	}
});
