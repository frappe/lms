frappe.ready(function () {
	frappe.web_form.after_save = () => {
		setTimeout(function () {
			window.location.href = '/event/conference2021/about';
		  }, 2000);
	}
})