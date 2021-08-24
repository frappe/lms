frappe.ready(function () {
	frappe.web_form.after_load = () => {
		frappe.web_form.set_value("user", frappe.session.user);
	  }
	frappe.web_form.after_save = () => {
		setTimeout(function () {
			window.location.href = '/event/conference2021/propose-talk';
		  }, 2000);
	}
})