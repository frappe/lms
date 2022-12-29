frappe.ready(() => {
	this.marked_as_complete = false;
	this.quiz_submitted = false;
	this.file_type;
	let self = this;

	localStorage.removeItem($("#quiz-title").data("name"));

	fetch_assignments();

	save_current_lesson();

	set_file_type();

	$(".option").click((e) => {
		enable_check(e);
	});

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

	$("#summary").click((e) => {
		quiz_summary(e);
	});

	$("#check").click((e) => {
		check_answer(e);
	});

	$("#next").click((e) => {
		mark_active_question(e);
	});

	$("#try-again").click((e) => {
		try_quiz_again(e);
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

	$(".btn-lesson").click((e) => {
		save_lesson(e);
	});

	$(".add-attachment").click((e) => {
		show_upload_modal();
	});

	$(".btn-start-quiz").click((e) => {
		$("#start-banner").addClass("hide");
		$("#quiz-form").removeClass("hide");
		mark_active_question();
	});

	$(".btn-edit").click((e) => {
		window.location.href = `${window.location.href}?edit=1`;
	});

	$(".btn-back").click((e) => {
		window.location.href = window.location.href.split("?")[0];
	});

	$(document).on("click", ".copy-link", (e) => {
		frappe.utils.copy_to_clipboard($(e.currentTarget).data("link"));
		$(".attachments").collapse("hide");
	});

	if ($("#quiz-title").data("max-attempts")) {
		window.addEventListener("beforeunload", (e) => {
			e.returnValue = "";
			if ($(".active-question").length && !self.quiz_submitted) {
				quiz_summary();
			}
		});
	}

	if ($("#body").length) {
		make_editor();
	}

	$("#file-type").change((e) => {
		$("#file-type option:selected").each(function () {
			self.file_type = $(this).val();
		});
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

const enable_check = (e) => {
	if ($(".option:checked").length) {
		$("#check").removeAttr("disabled");
		$(".custom-checkbox").removeClass("active-option");
		$(".option:checked")
			.closest(".custom-checkbox")
			.addClass("active-option");
	}
};

const mark_active_question = (e = undefined) => {
	$(".timer").addClass("hide");
	calculate_and_display_time(100);
	$(".timer").removeClass("hide");

	let current_index = $(".active-question").attr("data-qt-index") || 0;
	let next_index = parseInt(current_index) + 1;

	$(".question").addClass("hide").removeClass("active-question");
	$(`.question[data-qt-index='${next_index}']`)
		.removeClass("hide")
		.addClass("active-question");
	$(".current-question").text(`${next_index}`);
	$("#check").removeClass("hide").attr("disabled", true);
	$("#next").addClass("hide");
	$(".explanation").addClass("hide");
	initialize_timer();
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
			change_progress_indicators();
			show_certificate_if_course_completed(data);
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

const quiz_summary = (e = undefined) => {
	e && e.preventDefault();
	let quiz_name = $("#quiz-title").data("name");
	let total_questions = $(".question").length;
	let self = this;

	frappe.call({
		method: "lms.lms.doctype.lms_quiz.lms_quiz.quiz_summary",
		args: {
			quiz: quiz_name,
			results: localStorage.getItem(quiz_name),
		},
		callback: (data) => {
			$(".question").addClass("hide");
			$("#summary").addClass("hide");
			$("#quiz-form")
				.parent()
				.prepend(
					`<div class="summary">
                    <div class="font-weight-bold"> ${__("Score")}: ${
						data.message
					}/${total_questions} </div>
                </div>`
				);
			$("#try-again").removeClass("hide");
			self.quiz_submitted = true;
		},
	});
};

const try_quiz_again = (e) => {
	window.location.reload();
};

const check_answer = (e = undefined) => {
	e && e.preventDefault();
	clearInterval(self.timer);
	$(".timer").addClass("hide");
	let total_questions = $(".question").length;
	let current_index = $(".active-question").attr("data-qt-index");

	$(".explanation").removeClass("hide");
	$("#check").addClass("hide");

	if (current_index == total_questions) {
		if ($(".eligible-for-submission").length) {
			$("#summary").removeClass("hide");
		} else {
			$("#submission-message").removeClass("hide");
		}
	} else {
		$("#next").removeClass("hide");
	}
	let [answer, is_correct] = parse_options();
	add_to_local_storage(current_index, answer, is_correct);
};

const parse_options = () => {
	let answer = [];
	let is_correct = [];

	$(".active-question input").each((i, element) => {
		let correct = parseInt($(element).attr("data-correct"));
		if ($(element).prop("checked")) {
			answer.push(decodeURIComponent($(element).val()));
			correct && is_correct.push(1);
			correct ? add_icon(element, "check") : add_icon(element, "wrong");
		} else {
			correct && is_correct.push(0);
			correct
				? add_icon(element, "minus-circle-green")
				: add_icon(element, "minus-circle");
		}
	});

	return [answer, is_correct];
};

const add_icon = (element, icon) => {
	$(element).closest(".custom-checkbox").removeClass("active-option");
	let label = $(element).siblings(".option-text").text();
	$(element).siblings(".option-text").html(`
        <div>
            <img class="d-inline mr-3" src="/assets/lms/icons/${icon}.svg">
            ${label}
        </div>
    `);
	//$(element).parent().empty().html(`<div class="option-text"><img class="mr-3" src="/assets/lms/icons/${icon}.svg"> ${label}</div>`);
};

const add_to_local_storage = (current_index, answer, is_correct) => {
	let quiz_name = $("#quiz-title").data("name");
	let quiz_stored = JSON.parse(localStorage.getItem(quiz_name));

	let quiz_obj = {
		question_index: current_index,
		answer: answer.join(),
		is_correct: is_correct,
	};

	quiz_stored ? quiz_stored.push(quiz_obj) : (quiz_stored = [quiz_obj]);
	localStorage.setItem(quiz_name, JSON.stringify(quiz_stored));
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
		method: "lms.lms.doctype.lesson_assignment.lesson_assignment.upload_assignment",
		args: {
			assignment: file.file_url,
			lesson: $(".title").attr("data-lesson"),
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
		method: "lms.lms.doctype.lesson_assignment.lesson_assignment.get_assignment",
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
					.attr("href", assignment.assignment)
					.text(assignment.file_name);
			}
		},
	});
};

const initialize_timer = () => {
	this.time_left = $(".timer").data("time");
	calculate_and_display_time(100, this.time_left);
	$(".timer").removeClass("hide");
	const total_time = $(".timer").data("time");
	this.start_time = new Date().getTime();
	const self = this;
	let old_diff;

	this.timer = setInterval(function () {
		var diff = (new Date().getTime() - self.start_time) / 1000;
		var variation = old_diff ? diff - old_diff : diff;
		old_diff = diff;
		self.time_left -= variation;
		let percent_time = (self.time_left / total_time) * 100;
		calculate_and_display_time(percent_time);
		if (self.time_left <= 0) {
			clearInterval(self.timer);
			$(".timer").addClass("hide");
			check_answer();
		}
	}, 100);
};

const calculate_and_display_time = (percent_time) => {
	$(".timer .progress-bar").attr("aria-valuenow", percent_time);
	$(".timer .progress-bar").attr("aria-valuemax", percent_time);
	$(".timer .progress-bar").css("width", `${percent_time}%`);
	let progress_color = percent_time < 20 ? "red" : "var(--primary-color)";
	$(".timer .progress-bar").css("background-color", progress_color);
};

const save_lesson = (e) => {
	let lesson = $("#title").data("lesson");
	let self = this;
	frappe.call({
		method: "lms.lms.doctype.lms_course.lms_course.save_lesson",
		args: {
			title: $("#title").text(),
			body: this.code_field_group.fields_dict["code_md"].value,
			youtube: $("#youtube").text(),
			quiz_id: $("#quiz-id").text(),
			chapter: $("#title").data("chapter"),
			preview: $("#preview").prop("checked") ? 1 : 0,
			idx: $("#title").data("index"),
			lesson: lesson ? lesson : "",
			question: $("#assignment-question").text(),
			file_type: self.file_type,
		},
		callback: (data) => {
			frappe.show_alert({
				message: __("Saved"),
				indicator: "green",
			});
			setTimeout(() => {
				window.location.href = window.location.href.split("?")[0];
			}, 1000);
		},
	});
};

const show_upload_modal = () => {
	new frappe.ui.FileUploader({
		folder: "Home/Attachments",
		restrictions: {
			allowed_file_types: ["image/*", "video/*"],
		},
		on_success: (file_doc) => {
			$(".attachments").append(build_attachment_table(file_doc));
			let count = $(".attachment-count").data("count") + 1;
			$(".attachment-count").data("count", count);
			$(".attachment-count").html(__(`${count} attachments`));
			$(".attachments").removeClass("hide");
		},
	});
};

const build_attachment_table = (file_doc) => {
	let video_types = ["mov", "mp4", "mkv"];
	let video_extension = file_doc.file_url.split(".").pop();
	let is_video = video_types.indexOf(video_extension) >= 0;
	let link = is_video
		? `{{ Video('${file_doc.file_url}') }}`
		: `![](${file_doc.file_url})`;

	return $(`
        <tr class="attachment-row">
            <td>${file_doc.file_name}</td>
            <td class="">
                <a class="button is-secondary button-links copy-link" data-link="${link}"
                data-name="${file_doc.file_name}" > ${__("Copy Link")}
                </a>
            </td>
        </tr>
    `);
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
				default: $("#body").data("body"),
				depends_on: 'eval:doc.type=="Markdown"',
			},
		],
		body: $("#body").get(0),
	});
	this.code_field_group.make();
	$("#body .form-section:last").removeClass("empty-section");
	$("#body .frappe-control").removeClass("hide-control");
	$("#body .form-column").addClass("p-0");
};

const set_file_type = () => {
	let self = this;
	let file_type = $("#file-type").data("type");
	if (file_type) {
		$("#file-type option").each((i, elem) => {
			if ($(elem).val() == file_type) {
				$(elem).attr("selected", true);
				self.file_type = file_type;
			}
		});
	}
};
