frappe.ready(() => {
	hide_wrapped_mentor_cards();

	$("#cancel-request").click((e) => {
		cancel_mentor_request(e);
	});

	$(".view-all-mentors").click((e) => {
		view_all_mentors(e);
	});

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

	$("#apply-certificate").click((e) => {
		apply_cetificate(e);
	});

	$("#slot-date").on("change", (e) => {
		display_slots(e);
	});

	$("#submit-slot").click((e) => {
		submit_slot(e);
	});

	$(".close-slot-modal").click((e) => {
		close_slot_modal(e);
	});

	$(document).on("click", ".slot", (e) => {
		select_slot(e);
	});

	$(".btn-attach").click((e) => {
		show_upload_modal(e);
	});

	$(".btn-clear").click((e) => {
		clear_image(e);
	});

	$(".btn-tag").click((e) => {
		add_tag(e);
	});

	$(".btn-save-course").click((e) => {
		save_course(e);
	});

	$(".btn-delete-tag").click((e) => {
		remove_tag(e);
	});

	if ($("#description").length) {
		make_editor();
	}
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

const cancel_mentor_request = (e) => {
	e.preventDefault();
	frappe.call({
		method: "lms.lms.doctype.lms_mentor_request.lms_mentor_request.cancel_request",
		args: {
			course: decodeURIComponent($(e.currentTarget).attr("data-course")),
		},
		callback: (data) => {
			if (data.message == "OK") {
				$("#mentor-request").removeClass("hide");
				$("#already-applied").addClass("hide");
			}
		},
	});
};

const view_all_mentors = (e) => {
	$(".wrapped").each((i, element) => {
		$(element).slideToggle("slow");
	});
	var text_element = $(
		".view-all-mentors .course-instructor .all-mentors-text"
	);
	var text =
		text_element.text() == "View all mentors"
			? "View less"
			: "View all mentors";
	text_element.text(text);

	if ($(".mentor-icon").css("transform") == "none") {
		$(".mentor-icon").css("transform", "rotate(180deg)");
	} else {
		$(".mentor-icon").css("transform", "");
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

const apply_cetificate = (e) => {
	$("#slot-modal").modal("show");
};

const submit_slot = (e) => {
	e.preventDefault();
	const slot = window.selected_slot;
	frappe.call({
		method: "lms.lms.doctype.lms_certificate_request.lms_certificate_request.create_certificate_request",
		args: {
			course: slot.data("course"),
			date: $("#slot-date").val(),
			day: slot.data("day"),
			start_time: slot.data("start"),
			end_time: slot.data("end"),
		},
		callback: (data) => {
			$("#slot-modal").modal("hide");
			frappe.show_alert(
				{
					message: __(
						"Your slot has been booked. Prepare well for the evaluations."
					),
					indicator: "green",
				},
				3
			);
			setTimeout(() => {
				window.location.reload();
			}, 3000);
		},
	});
};

const display_slots = (e) => {
	frappe.call({
		method: "lms.lms.doctype.course_evaluator.course_evaluator.get_schedule",
		args: {
			course: $(e.currentTarget).data("course"),
			date: $(e.currentTarget).val(),
		},
		callback: (data) => {
			let options = "";
			data.message.forEach((obj) => {
				options += `<button type="button" class="btn btn-sm btn-secondary mb-3 mr-3 slot hide"
                    data-course="${$(e.currentTarget).data("course")}"
                    data-day="${obj.day}" data-start="${
					obj.start_time
				}" data-end="${obj.end_time}">
                    ${format_time(obj.start_time)} - ${format_time(
					obj.end_time
				)}</button>`;
			});
			e.preventDefault();
			$("#slot-modal .slots").html(options);
			const weekday = [
				"Sunday",
				"Monday",
				"Tuesday",
				"Wednesday",
				"Thursday",
				"Friday",
				"Saturday",
			];
			const day = weekday[new Date($(e.currentTarget).val()).getDay()];

			$(".slot").addClass("hide");
			$(".slot-label").addClass("hide");

			if ($(`[data-day='${day}']`).length) {
				$(".slot-label").removeClass("hide");
				$(`[data-day='${day}']`).removeClass("hide");
				$("#no-slots-message").addClass("hide");
			} else {
				$("#no-slots-message").removeClass("hide");
			}
		},
	});
};

const select_slot = (e) => {
	$(".slot").removeClass("btn-outline-primary");
	$(e.currentTarget).addClass("btn-outline-primary");
	window.selected_slot = $(e.currentTarget);
};

const format_time = (time) => {
	let date = moment(new Date()).format("ddd MMM DD YYYY");
	return moment(`${date} ${time}`).format("HH:mm a");
};

const close_slot_modal = (e) => {
	$("#slot-date").val("");
	$(".slot-label").addClass("hide");
};

const show_upload_modal = () => {
	new frappe.ui.FileUploader({
		folder: "Home/Attachments",
		restrictions: {
			allowed_file_types: ["image/*"],
		},
		on_success: (file_doc) => {
			$(".course-image-attachment").removeClass("hide");
			$(".course-image-attachment a")
				.attr("href", file_doc.file_url)
				.text(file_doc.file_url);
			$(".btn-attach").addClass("hide");
		},
	});
};

const clear_image = () => {
	$(".course-image-attachment").addClass("hide");
	$(".course-image-attachment a").removeAttr("href");
	$(".btn-attach").removeClass("hide");
};

const add_tag = (e) => {
	$(`<div class="course-card-pills" contenteditable="true"
        data-placeholder="${__("Tag")}"></div>`).insertBefore(`.btn-tag`);
};

const save_course = (e) => {
	let tags = $(".course-card-pills")
		.map((i, el) => $(el).text().trim())
		.get();
	tags = tags.filter((word) => word.trim().length > 0);

	frappe.call({
		method: "lms.lms.doctype.lms_course.lms_course.save_course",
		args: {
			tags: tags.join(", "),
			title: $("#title").text(),
			short_introduction: $("#intro").text(),
			video_link: $("#video-link").text(),
			image: $("#image").attr("href"),
			description: this.code_field_group.fields_dict["code_md"].value,
			course: $("#title").data("course")
				? $("#title").data("course")
				: "",
			published: $("#published").prop("checked") ? 1 : 0,
			upcoming: $("#upcoming").prop("checked") ? 1 : 0,
		},
		callback: (data) => {
			frappe.show_alert({
				message: __("Saved"),
				indicator: "green",
			});
			setTimeout(() => {
				window.location.href = `/courses/${data.message}?edit=1`;
			}, 1000);
		},
	});
};

const remove_tag = (e) => {
	$(e.currentTarget).closest(".course-card-pills").remove();
};

const make_editor = () => {
	this.code_field_group = new frappe.ui.FieldGroup({
		fields: [
			{
				fieldname: "code_md",
				fieldtype: "Code",
				options: "Markdown",
				wrap: true,
				max_lines: Infinity,
				min_lines: 20,
				default: $("#description").data("description"),
				depends_on: 'eval:doc.type=="Markdown"',
			},
		],
		body: $("#description").get(0),
	});
	this.code_field_group.make();
	$("#description .form-section:last").removeClass("empty-section");
	$("#description .frappe-control").removeClass("hide-control");
	$("#description .form-column").addClass("p-0");
};
