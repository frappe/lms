// Copyright (c) 2025, Frappe and contributors
// For license information, please see license.txt

class EvidhyaController {
	constructor(frm) {
		this.frm = frm;
		this.init_handlers();
	}

	init_handlers() {
		this.frm.custom_buttons = {};
		this.frm.script_manager.trigger("refresh");
	}

	add_custom_buttons() {
		this.add_regenerate_url_button();
	}

	add_regenerate_url_button() {
		this.frm.add_custom_button(__("Regenerate URL"), () =>
			this.regenrate_url()
		);
	}

	async regenrate_url() {
		try {
			await frappe.xcall(
				"lms.lms.doctype.evidhya_settings.evidhya_settings.regenerate_url"
			);
			frappe.msgprint(__("URL regenerated successfully"));
		} catch (err) {
			this.handle_regeneration_error(err);
		}
	}
}

frappe.ui.form.on("Evidhya Settings", {
	refresh(frm) {
		if (!frm.evidhya_controller) {
			frm.evidhya_controller = new EvidhyaController(frm);
		}

		if (!frm.doc.__islocal) {
			frm.evidhya_controller.add_custom_buttons();
		}
	},
});