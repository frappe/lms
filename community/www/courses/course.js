frappe.ready(() => {
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
	var add_message = (message, session_user = false) => {
		var author_name = session_user ? "You" : message.author_name
		return `<div class="list-group-item">
							<h6> ${author_name} </h6>
							${message.message}
							<div class="small text-muted text-right"> ${message.creation} </div>
						</div>`;
	}
	/* if(frappe.session.user != "Guest"){
		frappe.call('community.www.courses.course.has_enrolled', { course: get_search_params().get("course") }, (data) => {
			if (data.message) {
				show_enrollment_badge()
			}
		})
	} */
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

