frappe.ready(function() {
	// bind events here
	frappe.web_form.after_load = () => {
		frappe.web_form.set_value(["batch"], [frappe.utils.get_url_arg('batch')]);
		frappe.web_form.set_value(["author"], [frappe.utils.get_url_arg('author')]);
	}
	frappe.web_form.success_url = `courses/course?course=${frappe.utils.get_url_arg('course')}`;

	$('.breadcrumb-container')
		.html(`<a href="${frappe.web_form.success_url}">Back to my course</a>`)
		.addClass('py-4');
})