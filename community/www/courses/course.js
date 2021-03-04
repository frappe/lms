frappe.ready(() => {
	if(frappe.session.user != "Guest"){
		var url_params = new URLSearchParams(window.location.search);
		frappe.call('community.www.courses.course.has_enrolled', { course: url_params.get("course") }, (data) => {
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

$('.btn-enroll').on('click', (e) => {
	frappe.call('community.www.courses.course.enroll', { course: $(e.target).attr("data-course") }, (data) => {
		show_enrollment_badge()
	});
});

