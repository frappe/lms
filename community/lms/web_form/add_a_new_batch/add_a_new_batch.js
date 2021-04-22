frappe.ready(function () {
	frappe.web_form.after_save = () => {
		let data = frappe.web_form.get_values();
		frappe.call({
			"method": "community.lms.doctype.lms_batch_membership.lms_batch_membership.create_membership",
			"args": {
				"batch": data.title,
				"member_type": "Mentor"
			},
			"callback": (data) => {
				if (data.message == "OK") {
					window.location.href = "/courses"
				}
			}
		})
	}

	frappe.web_form.validate = () => {
		let data = frappe.web_form.get_values();
		if (!frappe.datetime.validate(data.start_time) || !frappe.datetime.validate(data.end_time)) {
			frappe.msgprint(__('Invalid Start or End Time.'));
			return false;
		}
		if (data.start_time > data.end_time) {
			frappe.msgprint(__('Start Time should be less than End Time.'));
			return false;
		}
		console.log(data.start_date, date.nowdate())
		if (data.start_date < date.nowdate()) {
			frappe.msgprint(__('Start date cannot be a past date.'))
			return false;
		}
		return true;
	};	
})