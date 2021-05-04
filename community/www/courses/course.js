frappe.ready(() => {
	if (frappe.session.user != "Guest") {
		frappe.call({
			'method': 'community.lms.doctype.lms_mentor_request.lms_mentor_request.has_requested',
			'args': {
				course: decodeURIComponent($("#course-title").attr("data-course")),
			},
			'callback': (data) => {
				if (data.message) {
					$("#mentor-request").addClass("hide");
					$("#already-applied").removeClass("hide")
				}
			}
		})
	}

	$("#apply-now").click((e) => {
    e.preventDefault();
		if (frappe.session.user == "Guest") {
			window.location.href = "/login";
			return;
		}
		frappe.call({
			"method": "community.lms.doctype.lms_mentor_request.lms_mentor_request.create_request",
			"args": {
				"course": decodeURIComponent($(e.currentTarget).attr("data-course"))
			},
			"callback": (data) => {
				if (data.message == "OK") {
					$("#mentor-request").addClass("hide");
					$("#already-applied").removeClass("hide")
				}
			}
		})
	})

	$("#cancel-request").click((e) => {
    e.preventDefault()
		frappe.call({
			"method": "community.lms.doctype.lms_mentor_request.lms_mentor_request.cancel_request",
			"args": {
				"course": decodeURIComponent($(e.currentTarget).attr("data-course"))
			},
			"callback": (data) => {
				if (data.message == "OK") {
					$("#mentor-request").removeClass("hide");
					$("#already-applied").addClass("hide")
				}
			}
		})
	})

	$(".join-batch").click((e) => {
    e.preventDefault()
		if (frappe.session.user == "Guest") {
			window.location.href = "/login";
			return;
		}
		batch = decodeURIComponent($(e.currentTarget).attr("data-batch"))
		frappe.call({
			"method": "community.lms.doctype.lms_batch_membership.lms_batch_membership.create_membership",
			"args": {
				"batch": batch
			},
			"callback": (data) => {
				if (data.message == "OK") {
					frappe.msgprint(__("You are now a student of this course."))
				}
			}
		})
	})
})

