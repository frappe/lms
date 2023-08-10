frappe.ready(() => {
	this.marked_as_complete = false;
	let self = this;

	frappe.telemetry.capture("on_lesson_page", "lms");

	fetch_assignments();

	save_current_lesson();

	$(window).scroll(() => {
		let self = this;
		if (
			!$("#status-indicator").length &&
			!self.marked_as_complete &&
			$(".title").hasClass("is-member")
		) {
			self.marked_as_complete = true;
			mark_progress();
		}
	});

	$("#certification").click((e) => {
		create_certificate(e);
	});

	$(".submit-work").click((e) => {
		attach_work(e);
	});

	$(".clear-work").click((e) => {
		clear_work(e);
	});

	$(".btn-back").click((e) => {
		window.location.href = window.location.href.split("?")[0];
	});

	$(document).on("click", ".copy-link", (e) => {
		frappe.utils.copy_to_clipboard($(e.currentTarget).data("link"));
		$(".attachments").collapse("hide");
	});
});

const save_current_lesson = () => {
	if ($(".title").hasClass("is-member")) {
		frappe.call("lms.lms.api.save_current_lesson", {
			course_name: $(".title").attr("data-course"),
			lesson_name: $(".title").attr("data-lesson"),
		});
	}
};

const mark_progress = () => {
	let status = "Complete";
	frappe.call({
		method: "lms.lms.doctype.course_lesson.course_lesson.save_progress",
		args: {
			lesson: $(".title").attr("data-lesson"),
			course: $(".title").attr("data-course"),
			status: status,
		},
		callback: (data) => {
			if (data.message) {
				change_progress_indicators();
				show_certificate_if_course_completed(data);
			}
		},
	});
};

const change_progress_indicators = () => {
	$(".active-lesson .lesson-progress-tick").removeClass("hide");
};

const show_certificate_if_course_completed = (data) => {
	if (
		data.message == 100 &&
		!$(".next").length &&
		$("#certification").hasClass("hide")
	) {
		$("#certification").removeClass("hide");
	}
};

const create_certificate = (e) => {
	e.preventDefault();
	course = $(".title").attr("data-course");
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

const attach_work = (e) => {
	const target = $(e.currentTarget);
	let files = target.siblings(".attach-file").prop("files");
	if (files && files.length) {
		files = add_files(files);
		return_as_dataurl(files);
		files.map((file) => {
			upload_file(file, target);
		});
	}
};

const upload_file = (file, target) => {
	return new Promise((resolve, reject) => {
		let xhr = new XMLHttpRequest();

		xhr.onreadystatechange = () => {
			if (xhr.readyState == XMLHttpRequest.DONE) {
				if (xhr.status === 200) {
					let response = JSON.parse(xhr.responseText);
					create_lesson_work(response.message, target);
				} else if (xhr.status === 403) {
					let response = JSON.parse(xhr.responseText);
					frappe.msgprint(
						`Not permitted. ${response._error_message || ""}`
					);
				} else if (xhr.status === 413) {
					frappe.msgprint(
						__("Size exceeds the maximum allowed file size.")
					);
				} else {
					frappe.msgprint(
						xhr.status === 0
							? "XMLHttpRequest Error"
							: `${xhr.status} : ${xhr.statusText}`
					);
				}
			}
		};
		xhr.open("POST", "/api/method/upload_file", true);
		xhr.setRequestHeader("Accept", "application/json");
		xhr.setRequestHeader("X-Frappe-CSRF-Token", frappe.csrf_token);

		let form_data = new FormData();
		if (file.file_obj) {
			form_data.append("file", file.file_obj, file.name);
		}

		xhr.send(form_data);
	});
};

const create_lesson_work = (file, target) => {
	frappe.call({
		method: "lms.lms.doctype.lms_assignment_submission.lms_assignment_submission.upload_assignment",
		args: {
			assignment_attachment: file.file_url,
			lesson: $(".title").attr("data-lesson"),
			submission: $(".preview-work").data("submission") || "",
		},
		callback: (data) => {
			target.siblings(".attach-file").addClass("hide");
			target.siblings(".preview-work").removeClass("hide");
			target
				.siblings(".preview-work")
				.find("a")
				.attr("href", file.file_url)
				.text(file.file_name);
			target.addClass("hide");
		},
	});
};

const return_as_dataurl = (files) => {
	let promises = files.map((file) =>
		frappe.dom.file_to_base64(file.file_obj).then((dataurl) => {
			file.dataurl = dataurl;
			this.on_success && this.on_success(file);
		})
	);
	return Promise.all(promises);
};

const add_files = (files) => {
	files = Array.from(files).map((file) => {
		let is_image = file.type.startsWith("image");
		return {
			file_obj: file,
			cropper_file: file,
			crop_box_data: null,
			optimize: this.attach_doc_image ? true : false,
			name: file.name,
			doc: null,
			progress: 0,
			total: 0,
			failed: false,
			request_succeeded: false,
			error_message: null,
			uploading: false,
			private: !is_image,
		};
	});
	return files;
};

const clear_work = (e) => {
	const target = $(e.currentTarget);
	const parent = target.closest(".preview-work");
	parent.addClass("hide");
	parent.siblings(".attach-file").removeClass("hide").val(null);
	parent.siblings(".submit-work").removeClass("hide");
};

const fetch_assignments = () => {
	if ($(".attach-file").length <= 0) return;
	frappe.call({
		method: "lms.lms.doctype.lms_assignment_submission.lms_assignment_submission.get_assignment",
		args: {
			lesson: $(".title").attr("data-lesson"),
		},
		callback: (data) => {
			if (data.message) {
				const assignment = data.message;
				const status = assignment.status;
				let target = $(".attach-file");
				target.addClass("hide");
				target.siblings(".submit-work").addClass("hide");
				target.siblings(".preview-work").removeClass("hide");
				if (status != "Not Graded") {
					let color = status == "Pass" ? "green" : "red";
					$(".assignment-status")
						.removeClass("hide")
						.addClass(color)
						.text(data.message.status);
					target.siblings(".alert").addClass("hide");
					$(".clear-work").addClass("hide");
					if (assignment.comments) {
						$(".comments").removeClass("hide");
						$(".comment").text(assignment.comments);
					}
				}
				target
					.siblings(".preview-work")
					.find("a")
					.attr("href", assignment.assignment_attachment)
					.text(assignment.file_name);

				target
					.siblings(".preview-work")
					.attr("data-submission", assignment.name);
			}
		},
	});
};
