frappe.ready(() => {
	hide_wrapped_mentor_cards();

	$(".review-link").click((e) => {
		show_review_dialog(e);
	});

	$(".icon-rating").click((e) => {
		highlight_rating(e);
	});

	$("#submit-review").click((e) => {
		submit_review(e);
	});

	$("#certification").click((e) => {
		create_certificate(e);
	});

	$("#submit-for-review").click((e) => {
		submit_for_review(e);
	});
});

const hide_wrapped_mentor_cards = () => {
	let offset_top_prev;

	$(".member-parent .member-card").each(function () {
		var offset_top = $(this).offset().top;
		if (offset_top > offset_top_prev) {
			$(this).addClass("wrapped").slideUp("fast");
		}
		if (!offset_top_prev) {
			offset_top_prev = offset_top;
		}
	});

	if ($(".wrapped").length < 1) {
		$(".view-all-mentors").hide();
	}
};

const show_review_dialog = (e) => {
	e.preventDefault();
	$("#review-modal").modal("show");
};

const highlight_rating = (e) => {
	var rating = $(e.currentTarget).attr("data-rating");
	$(".icon-rating").removeClass("star-click");
	$(".icon-rating").each((i, elem) => {
		if (i <= rating - 1) {
			$(elem).addClass("star-click");
		}
	});
};

const submit_review = (e) => {
	e.preventDefault();
	let rating = $(".rating-field").children(".star-click").length;
	let review = $(".review-field").val();
	if (!rating) {
		$(".error-field").text("Please provide a rating.");
		return;
	}
	frappe.call({
		method: "lms.lms.doctype.lms_course_review.lms_course_review.submit_review",
		args: {
			rating: rating,
			review: review,
			course: decodeURIComponent($(e.currentTarget).attr("data-course")),
		},
		callback: (data) => {
			if (data.message == "OK") {
				$(".review-modal").modal("hide");
				frappe.show_alert(
					{
						message: __("Review submitted."),
						indicator: "green",
					},
					3
				);
				setTimeout(() => {
					window.location.reload();
				}, 1000);
			}
		},
	});
};

const create_certificate = (e) => {
	e.preventDefault();
	course = $(e.currentTarget).attr("data-course");
	frappe.call({
		method: "lms.lms.doctype.lms_certificate.lms_certificate.create_certificate",
		args: {
			course: course,
		},
		callback: (data) => {
			window.location.href = `/courses/${course}/${data.message.name}`;
		},
	});
};

const element_not_in_viewport = (el) => {
	const rect = el.getBoundingClientRect();
	return (
		rect.bottom < 0 ||
		rect.right < 0 ||
		rect.left > window.innerWidth ||
		rect.top > window.innerHeight
	);
};

const submit_for_review = (e) => {
	let course = $(e.currentTarget).data("course");
	frappe.call({
		method: "lms.lms.doctype.lms_course.lms_course.submit_for_review",
		args: {
			course: course,
		},
		callback: (data) => {
			if (data.message == "No Chp") {
				frappe.msgprint(
					__(`There are no chapters in this course.
                Please add chapters and lessons to your course before you submit it for review.`)
				);
			} else if (data.message == "OK") {
				frappe.show_alert(
					{
						message: __(
							"Your course has been submitted for review."
						),
						indicator: "green",
					},
					3
				);
				setTimeout(() => {
					window.location.reload();
				}, 1000);
			}
		},
	});
};
