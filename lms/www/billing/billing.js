frappe.ready(() => {
	if ($("#billing-form").length) {
		setup_billing();
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
	let course = decodeURIComponent($(e.currentTarget).attr("data-course"));

	frappe.call({
		method: "lms.lms.doctype.lms_course.lms_course.get_payment_options",
		args: {
			course: course,
			phone: address.phone,
		},
		callback: (data) => {
			data.message.handler = (response) => {
				handle_success(
					response,
					course,
					address,
					data.message.order_id
				);
			};
			let rzp1 = new Razorpay(data.message);
			rzp1.open();
		},
	});
};

const handle_success = (response, course, address, order_id) => {
	frappe.call({
		method: "lms.lms.doctype.lms_course.lms_course.verify_payment",
		args: {
			response: response,
			course: course,
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
