frappe.ready(() => {
    $(".join-batch").click((e) => {
        join_course(e);
    });

    $(".notify-me").click((e) => {
        notify_user(e);
    });

});

const join_course = (e) => {
    e.preventDefault();
    let course = $(e.currentTarget).attr("data-course");
    if (frappe.session.user == "Guest") {
        window.location.href = `/login?redirect-to=/courses/${course}`;
        return;
    }

    let batch = $(e.currentTarget).attr("data-batch");
    batch = batch ? decodeURIComponent(batch) : "";
    frappe.call({
        "method": "lms.lms.doctype.lms_batch_membership.lms_batch_membership.create_membership",
        "args": {
            "batch": batch ? batch : "",
            "course": course
        },
        "callback": (data) => {
            if (data.message == "OK") {
                $(".no-preview-modal").modal("hide");
                frappe.show_alert({
                    message: __("You are now a student of this course."),
                    indicator:'green'
                }, 3);
                setTimeout(function () {
                    window.location.href = `/courses/${course}/learn/1.1`;
                }, 3000);
            }
        }
    })
};

const notify_user = (e) => {
    e.preventDefault();
    var course = decodeURIComponent($(e.currentTarget).attr("data-course"));
    if (frappe.session.user == "Guest") {
      window.location.href = `/login?redirect-to=/courses/${course}`;
      return;
    }

    frappe.call({
        method: "lms.lms.doctype.lms_course_interest.lms_course_interest.capture_interest",
        args: {
            "course": course
        },
        callback: (data) => {
            $(".no-preview-modal").modal("hide");
            frappe.show_alert({
                message: __("You have opted to be notified for this course. You will receive an email when the course becomes available."),
                indicator:'green'
            }, 3);
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        }
    })
};
