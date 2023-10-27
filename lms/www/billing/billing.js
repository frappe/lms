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
				default: address && address.billing_name,
			},
			{
				fieldtype: "Data",
				label: __("Address Line 1"),
				fieldname: "address_line1",
				reqd: 1,
				default: address && address.address_line1,
			},
			{
				fieldtype: "Data",
				label: __("Address Line 2"),
				fieldname: "address_line2",
				default: address && address.address_line2,
			},
			{
				fieldtype: "Data",
				label: __("City/Town"),
				fieldname: "city",
				reqd: 1,
				default: address && address.city,
			},
			{
				fieldtype: "Data",
				label: __("State/Province"),
				fieldname: "state",
				default: address && address.state,
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
				only_select: 1,
				default: address && address.country,
				change: () => {
					change_currency();
				},
			},
			{
				fieldtype: "Data",
				label: __("Postal Code"),
				fieldname: "pincode",
				reqd: 1,
				default: address && address.pincode,
			},
			{
				fieldtype: "Data",
				label: __("Phone Number"),
				fieldname: "phone",
				reqd: 1,
				default: address && address.phone,
			},
			{
				fieldtype: "Link",
				label: __("Where did you hear about this?"),
				fieldname: "source",
				options: "LMS Source",
				only_select: 1,
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
	let new_address = this.billing.get_values();
	validate_address(new_address);
	let doctype = $(e.currentTarget).attr("data-doctype");
	let docname = decodeURIComponent($(e.currentTarget).attr("data-name"));

	frappe.call({
		method: "lms.lms.utils.get_payment_options",
		args: {
			doctype: doctype,
			docname: docname,
			phone: new_address.phone,
			country: new_address.country,
		},
		callback: (data) => {
			data.message.handler = (response) => {
				handle_success(
					response,
					doctype,
					docname,
					new_address,
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

const change_currency = () => {
	$("#gst-message").removeClass("hide");
	let country = this.billing.get_value("country");
	if (exception_country.includes(country)) {
		update_price(original_price_formatted);
		return;
	}
	frappe.call({
		method: "lms.lms.utils.change_currency",
		args: {
			country: country,
			amount: amount,
			currency: currency,
		},
		callback: (data) => {
			let current_price = $(".total-price").text();
			if (current_price != data.message) {
				update_price(data.message);
			}
			if (data.message.includes("INR")) {
				$("#gst-message").removeClass("hide").addClass("show");
			} else {
				$("#gst-message").removeClass("show").addClass("hide");
			}
		},
	});
};

const update_price = (price) => {
	$(".total-price").text(price);
	frappe.show_alert({
		message: "Total Price has been updated.",
		indicator: "yellow",
	});
};

const validate_address = (billing_address) => {
	if (billing_address.country == "India" && !billing_address.state)
		frappe.throw(__("State is mandatory."));

	const states = [
		"Andhra Pradesh",
		"Arunachal Pradesh",
		"Assam",
		"Bihar",
		"Chhattisgarh",
		"Goa",
		"Gujarat",
		"Haryana",
		"Himachal Pradesh",
		"Jharkhand",
		"Karnataka",
		"Kerala",
		"Madhya Pradesh",
		"Maharashtra",
		"Manipur",
		"Meghalaya",
		"Mizoram",
		"Nagaland",
		"Odisha",
		"Punjab",
		"Rajasthan",
		"Sikkim",
		"Tamil Nadu",
		"Telangana",
		"Tripura",
		"Uttar Pradesh",
		"Uttarakhand",
		"West Bengal",
	];
	if (
		billing_address.country == "India" &&
		!states.includes(billing_address.state)
	)
		frappe.throw(
			__(
				"Please enter a valid state with correct spelling and the first letter capitalized."
			)
		);
};
