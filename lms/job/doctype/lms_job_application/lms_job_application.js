// Copyright (c) 2024, Frappe and contributors
// For license information, please see license.txt

frappe.ui.form.on("LMS Job Application", {
	refresh(frm) {
		frm.set_query("user", function (doc) {
			return {
				filters: {
					ignore_user_type: 1,
				},
			};
		});

		frm.toggle_display("preview", false);

		// preview different file types
		frm.trigger("preview_file");
	},

	preview_file: function (frm) {
		let $preview = "";
		const file_url = '/files/' + frm.doc.resume; 

		$preview = $(`<div class="img_preview">
			<object style="background:#323639;" width="100%">
				<embed
					style="background:#323639;"
					width="100%"
					height="1190"
					src="${frappe.utils.escape_html(file_url)}" type="application/pdf"
				>
			</object>
		</div>`);

		if ($preview) {
			frm.toggle_display("preview", true);
			frm.get_field("preview_html").$wrapper.html($preview);
		}
	},
});
