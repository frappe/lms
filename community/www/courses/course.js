frappe.ready(() => {
	if(frappe.session.user != "Guest"){
		frappe.call('community.www.courses.course.has_enrolled', { course: get_search_params().get("course") }, (data) => {
			if (data.message) {
				show_enrollment_badge()
			}
		})
	}
})

var show_enrollment_badge = () => {
	$(".btn-enroll").addClass("hide");
	$(".enrollment-badge").removeClass("hide");
}

var get_search_params = () => {
	return new URLSearchParams(window.location.search)
}

$('.btn-enroll').on('click', (e) => {
	frappe.call('community.www.courses.course.enroll', { course: get_search_params().get("course") }, (data) => {
		show_enrollment_badge()
	});
});

