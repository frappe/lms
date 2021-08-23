frappe.ready(function () {
	frappe.web_form.after_save = () => {
		setTimeout(function () {
			window.location.href = '/about';
		  }, 2000);
	}
})