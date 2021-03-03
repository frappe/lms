/* frappe.ready(() => {
    var url_params = new URLSearchParams(window.location.search);
    frappe.call('community.www.courses.course.has_enrolled', { course: url_params.get("course") }, (data) => {
        if (data.message) {
            $(".btn-enroll").addClass("hide");
            $(".enrollment-details").removeClass("hide");
        }
    })
}) */

$('.btn-enroll').on('click', (e) => {
    frappe.call('community.www.courses.course.enroll', { course: $(e.target).attr("data-course") }, (data) => {
        $(".btn-enroll").addClass("hide");
        $(".enrollment-details").removeClass("hide");
    });
});

