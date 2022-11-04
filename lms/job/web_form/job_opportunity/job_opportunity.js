frappe.ready(function () {
	frappe.web_form.after_save = () => {
		setTimeout(() => {
			window.location.href = `/jobs`;
		});
	};
});
