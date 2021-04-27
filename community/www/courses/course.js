frappe.ready(() => {
	frappe.require("/assets/frappe/js/lib/socket.io.min.js");
	frappe.require("/assets/frappe/js/frappe/socketio_client.js");
	if (window.dev_server) {
		frappe.boot.socketio_port = "9000" //use socketio port shown when bench starts
	}
	frappe.socketio.init();
	console.log(frappe.socketio)
	//frappe.socketio.emittedDemo("mydata");
	frappe.realtime.on("new_lms_message", (data) => {
		console.log(data)
	})
	if (frappe.session.user != "Guest") {
		frappe.call({
			'method': 'community.lms.doctype.lms_mentor_request.lms_mentor_request.has_requested',
			'args': {
				course: decodeURIComponent($(".course-title").attr("data-course")),
			},
			'callback': (data) => {
				if (data.message) {
					$(".mentor-request").addClass("hide");
					$(".already-applied").removeClass("hide")
				}
			}
		})
	}

	$(".list-batch").click((e) => {
		var batch = decodeURIComponent($(e.currentTarget).attr("data-label"))
		$(".current-batch").text(batch)
		$(".send-message").attr("data-batch", batch)
		frappe.call("community.www.courses.course.get_messages", { batch: batch }, (data) => {
			if (data.message) {
				$(".discussions").children().remove();
				for (var i = 0; i < data.message.length; i++) {
					var element = add_message(data.message[i])
					$(".discussions").append(element);
				}
			}
		})
	})

	$(".apply-now").click((e) => {
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
					$(".mentor-request").addClass("hide");
					$(".already-applied").removeClass("hide")
				}
			}
		})
	})

	$(".cancel-request").click((e) => {
		frappe.call({
			"method": "community.lms.doctype.lms_mentor_request.lms_mentor_request.cancel_request",
			"args": {
				"course": decodeURIComponent($(e.currentTarget).attr("data-course"))
			},
			"callback": (data) => {
				if (data.message == "OK") {
					$(".mentor-request").removeClass("hide");
					$(".already-applied").addClass("hide")
				}
			}
		})
	})

	$(".join-batch").click((e) => {
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
					$(".upcoming-batches").addClass("hide")
				}
			}
		})
	})
})
/*
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
}); */

