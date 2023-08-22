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
				fieldtype: "Data",
				label: __("State/Province"),
				fieldname: "state",
			},
			{
				fieldtype: "Column Break",
			},
			{
				fieldtype: "Link",
				label: __("Country"),
				fieldname: "country",
				options: "Country",
				reqd: 1,
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
