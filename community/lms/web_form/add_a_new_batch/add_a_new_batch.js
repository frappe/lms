frappe.ready(function() {
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
})