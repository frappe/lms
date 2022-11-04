frappe.ready(function () {
	frappe.web_form.after_save = () => {
		let data = frappe.web_form.get_values();
		let slug = new URLSearchParams(window.location.search).get("slug");
		frappe.msgprint({
			message: __("Batch {0} has been successfully created!", [
				data.title,
			]),
			clear: true,
		});
		setTimeout(function () {
			window.location.href = `courses/${slug}`;
		}, 2000);
	};

	frappe.web_form.validate = () => {
		let sysdefaults = frappe.boot.sysdefaults;
		let time_format =
			sysdefaults && sysdefaults.time_format
				? sysdefaults.time_format
				: "HH:mm:ss";
		let data = frappe.web_form.get_values();

		data.start_time = moment(data.start_time, time_format).format(
			time_format
		);
		data.end_time = moment(data.end_time, time_format).format(time_format);

		if (data.start_date < frappe.datetime.nowdate()) {
			frappe.msgprint(__("Start date cannot be a past date."));
			return false;
		}

		if (
			!frappe.datetime.validate(data.start_time) ||
			!frappe.datetime.validate(data.end_time)
		) {
			frappe.msgprint(__("Invalid Start or End Time."));
			return false;
		}

		if (data.start_time > data.end_time) {
			frappe.msgprint(__("Start Time should be less than End Time."));
			return false;
		}

		return true;
	};
});
