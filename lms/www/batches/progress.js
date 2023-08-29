frappe.ready(() => {
	frappe.require("controls.bundle.js");

	$(".clickable-row").click((e) => {
		window.location.href = $(e.currentTarget).data("href");
	});

	$(".btn-certification").click((e) => {
		show_certificate_dialog(e);
	});
});

const show_certificate_dialog = (e) => {
	this.certificate_dialog = new frappe.ui.Dialog({
		title: __("Grant Certificate"),
		fields: [
			{
				fieldtype: "Link",
				fieldname: "course",
				label: __("Course"),
				options: "LMS Course",
				reqd: 1,
				filters: {
					name: ["in", courses],
				},
				filter_description: " ",
				only_select: 1,
			},
			{
				fieldtype: "Date",
				fieldname: "issue_date",
				label: __("Issue Date"),
				reqd: 1,
				default: frappe.datetime.get_today(),
			},
			{
				fieldtype: "Date",
				fieldname: "expiry_date",
				label: __("Expiry Date"),
			},
		],
	});

	this.certificate_dialog.show();
};
