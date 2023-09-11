frappe.ready(() => {
	if ($("#billing-form").length) {
		frappe.require("controls.bundle.js", () => {
			setup_billing();
		});
	}

	$(".btn-pay").click((e) => {
		generate_payment_link(e);
	});
});

const setup_billing = () => {
	this.billing = new frappe.ui.FieldGroup({
		fields: [
			{
				fieldtype: "Data",
				label: __("Billing Name"),
				fieldname: "billing_name",
				reqd: 1,
			},
			{
				fieldtype: "Data",
				label: __("Address Line 1"),
				fieldname: "address_line1",
				reqd: 1,
			},
			{
				fieldtype: "Data",
				label: __("Address Line 2"),
				fieldname: "address_line2",
			},
			{
				fieldtype: "Data",
				label: __("City/Town"),
				fieldname: "city",
				reqd: 1,
			},
			{
				fieldtype: "Column Break",
			},
			{
				fieldtype: "Data",
				label: __("State/Province"),
				fieldname: "state",
			},
			{
				fieldtype: "Link",
				label: __("Country"),
				fieldname: "country",
				options: "Country",
				reqd: 1,
				only_select: 1,
			},
			{
				fieldtype: "Data",
				label: __("Postal Code"),
				fieldname: "pincode",
				reqd: 1,
			},
			{
				fieldtype: "Data",
				label: __("Phone Number"),
				fieldname: "phone",
				reqd: 1,
			},
			{
				fieldtype: "Section Break",
				label: __("GST Details"),
				fieldname: "gst_details",
				depends_on: "eval:doc.country === 'India'",
			},
			{
				fieldtype: "Data",
				label: __("GSTIN"),
				fieldname: "gstin",
			},
			{
				fieldtype: "Column Break",
				fieldname: "gst_details_break",
			},
			{
				fieldtype: "Data",
				fieldname: "pan",
				label: __("PAN"),
			},
		],
		body: $("#billing-form").get(0),
	});
	this.billing.make();
	$("#billing-form .form-section:last").removeClass("empty-section");
	$("#billing-form .frappe-control").removeClass("hide-control");
	$("#billing-form .form-column").addClass("p-0");
};

const generate_payment_link = (e) => {
	address = this.billing.get_values();
	let doctype = $(e.currentTarget).attr("data-doctype");
	let docname = decodeURIComponent($(e.currentTarget).attr("data-name"));

	frappe.call({
		method: "lms.lms.utils.get_payment_options",
		args: {
			doctype: doctype,
			docname: docname,
			phone: address.phone,
			country: address.country,
		},
		callback: (data) => {
			data.message.handler = (response) => {
				handle_success(
					response,
					doctype,
					docname,
					address,
					data.message.order_id
				);
			};
			let rzp1 = new Razorpay(data.message);
			rzp1.open();
		},
	});
};

const handle_success = (response, doctype, docname, address, order_id) => {
	frappe.call({
		method: "lms.lms.utils.verify_payment",
		args: {
			response: response,
			doctype: doctype,
			docname: docname,
			address: address,
			order_id: order_id,
		},
		callback: (data) => {
			frappe.show_alert({
				message: __("Payment Successful"),
				indicator: "green",
			});
			setTimeout(() => {
				window.location.href = data.message;
			}, 1000);
		},
	});
};
