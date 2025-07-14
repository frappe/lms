// Copyright (c) 2021, FOSS United and contributors
// For license information, please see license.txt

frappe.ui.form.on("LMS Settings", {
	setup: function (frm) {
		frappe.call({
			method: "lms.lms.doctype.lms_settings.lms_settings.check_payments_app",
			callback: (data) => {
				if (!data.message) {
					frm.set_df_property("payment_section", "hidden", 1);
					frm.trigger("set_no_payments_app_html");
				} else {
					frm.set_df_property("no_payments_app", "hidden", 1);
				}
			},
		});
	},

	set_no_payments_app_html(frm) {
		frm.get_field("payments_app_is_not_installed").html(`
				<div class="alert alert-warning">
					Please install the
					<a target="_blank" style="text-decoration: underline; color: var(--alert-text-warning); background: var(--alert-bg-warning);" href="https://frappecloud.com/marketplace/apps/payments">Payments app</a>
					 to enable payment gateway. Refer to the
					 <a target="_blank" style="text-decoration: underline; color: var(--alert-text-warning); background: var(--alert-bg-warning);" href="https://docs.frappe.io/learning/setting-up-payment-gateway">Documentation</a>
					 for more information.
				</div>
			`);
	},
});
