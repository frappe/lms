frappe.ready(function() {
	frappe.web_form.after_save = () => {
		window.location.href = frappe.web_form.get_value("username")
	}
})