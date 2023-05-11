frappe.ready(() => {
	this.marked_as_complete = false;
	this.quiz_submitted = false;
	this.answer = [];
	this.is_correct = [];
	let self = this;

	localStorage.removeItem($("#quiz-title").data("name"));

	fetch_assignments();

	save_current_lesson();

	$(".option").click((e) => {
		enable_check(e);
	});

	$(".possibility").keyup((e) => {
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
		add_to_local_storage();
		quiz_summary(e);
	});

	$("#check").click((e) => {
		check_answer(e);
	});

	$("#next").click((e) => {
		add_to_local_storage();
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

	$(".btn-start-quiz").click((e) => {
		$("#start-banner").addClass("hide");
		$("#quiz-form").removeClass("hide");
		mark_active_question();
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
	parse_options();
};

const parse_options = () => {
	let type = $(".active-question").data("type");

	if (type == "Choices") {
		$(".active-question input").each((i, element) => {
			is_answer_correct(type, element);
		});
	} else {
		is_answer_correct(type, $(".active-question textarea"));
	}
};

const is_answer_correct = (type, element) => {
	let answer = decodeURIComponent($(element).val());

	frappe.call({
		async: false,
		method: "lms.lms.doctype.lms_quiz.lms_quiz.check_answer",
		args: {
			question: $(".active-question").data("name"),
			type: type,
			answer: answer,
		},
		callback: (data) => {
			type == "Choices"
				? parse_choices(element, data.message)
				: parse_possible_answers(element, data.message);
		},
	});
};

const parse_choices = (element, correct) => {
	if ($(element).prop("checked")) {
		self.answer.push(decodeURIComponent($(element).val()));
		correct && self.is_correct.push(1);
		correct ? add_icon(element, "check") : add_icon(element, "wrong");
	} else {
		correct && self.is_correct.push(0);
		correct
			? add_icon(element, "minus-circle-green")
			: add_icon(element, "minus-circle");
	}
};

const parse_possible_answers = (element, correct) => {
	self.answer.push(decodeURIComponent($(element).val()));
	if (correct) {
		self.is_correct.push(1);
		show_indicator("success", element);
	} else {
		self.is_correct.push(0);
		show_indicator("failure", element);
	}
};

const show_indicator = (class_name, element) => {
	let label = class_name == "success" ? "Correct" : "Incorrect";
	let icon =
		class_name == "success" ? "#icon-solid-success" : "#icon-solid-error";
	$(`<div class="answer-indicator ${class_name}">
			<svg class="icon icon-md">
				<use href=${icon}>
			</svg>
			<span style="font-weight: 500">${__(label)}</span>
		</div>`).insertAfter(element);
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
};

const add_to_local_storage = () => {
	let current_index = $(".active-question").attr("data-qt-index");
	let quiz_name = $("#quiz-title").data("name");
	let quiz_stored = JSON.parse(localStorage.getItem(quiz_name));

	let quiz_obj = {
		question_index: current_index,
		answer: self.answer.join(),
		is_correct: self.is_correct,
	};

	quiz_stored ? quiz_stored.push(quiz_obj) : (quiz_stored = [quiz_obj]);
	localStorage.setItem(quiz_name, JSON.stringify(quiz_stored));

	self.answer = [];
	self.is_correct = [];
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
