frappe.ready(function () {
	// bind events here
	frappe.web_form.success_url = `hackathons/project?project=${frappe.utils.get_url_arg('project')}&hackathon=${frappe.utils.get_url_arg('hackathon')}`;

	$('.breadcrumb-container')
		.html(`<a href="${frappe.web_form.success_url}">Back to my project</a>`)
		.addClass('py-4');
})