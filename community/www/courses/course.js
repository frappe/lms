frappe.ready(() => {
	if (frappe.session.user != "Guest") {
		frappe.call({
			'method': 'community.lms.doctype.lms_mentor_request.lms_mentor_request.has_requested',
			'args': {
				course: $(".course-title").attr("data-course"),
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

	$(".send-message").click((e) => {
		var message = $(".message-text").val().trim();
		if (message) {
			frappe.call({
				"method": "community.www.courses.course.save_message",
				"args": {
					"batch": decodeURIComponent($(e.target).attr("data-batch")),
					"author": decodeURIComponent($(e.target).attr("data-author")),
					"message": message
				},
				"callback": (data) => {
					$(".message-text").val("");
					var element = add_message(data.message, true)
					$(".discussions").prepend(element);
				}
			})
		}
		else {
			$(".message-text").val("");
		}
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
			"method": "community.lms.doctype.lms_batch_membership.lms_batch_membership.create_member",
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

	var add_message = (message, session_user = false) => {
		var author_name = session_user ? "You" : message.author_name
		return `<div class="list-group-item">
							<h6> ${author_name} </h6>
							${message.message}
							<div class="small text-muted text-right"> ${message.creation} </div>
						</div>`;
	}
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

