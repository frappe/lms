frappe.ready(() => {
	this.quiz_submitted = false;
	this.answer = [];
	this.is_correct = [];
	const self = this;
	localStorage.removeItem($("#quiz-title").data("name"));

	$(".btn-start-quiz").click((e) => {
		$("#start-banner").addClass("hide");
		$("#quiz-form").removeClass("hide");
		mark_active_question();
	});

	$(".option").click((e) => {
		if (!$("#check").hasClass("hide")) enable_check(e);
	});

	$(".possibility").keyup((e) => {
		enable_check(e);
	});

	$("#summary").click((e) => {
		e.preventDefault();
		add_to_local_storage();
		quiz_summary(e);
	});

	$("#check").click((e) => {
		e.preventDefault();
		check_answer(e);
	});

	$("#next").click((e) => {
		e.preventDefault();
		add_to_local_storage();
		mark_active_question(e);
	});

	$("#try-again").click((e) => {
		try_quiz_again(e);
	});
});

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

const calculate_and_display_time = (percent_time) => {
	$(".timer .progress-bar").attr("aria-valuenow", percent_time);
	$(".timer .progress-bar").attr("aria-valuemax", percent_time);
	$(".timer .progress-bar").css("width", `${percent_time}%`);
	let progress_color = percent_time < 20 ? "red" : "var(--primary-color)";
	$(".timer .progress-bar").css("background-color", progress_color);
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

const enable_check = (e) => {
	if ($(".option:checked").length || $(".possibility").val().trim()) {
		$("#check").removeAttr("disabled");
		$(".custom-checkbox").removeClass("active-option");
		$(".option:checked")
			.closest(".custom-checkbox")
			.addClass("active-option");
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
			$(".quiz-footer span").addClass("hide");
			$("#quiz-form").prepend(
				`<div class="summary bold-heading text-center">
					${__("Your score is")} ${data.message.score}
					${__("out of")} ${total_questions}
				</div>`
			);
			$("#try-again").attr("data-submission", data.message.submission);
			$("#try-again").removeClass("hide");
			self.quiz_submitted = true;
		},
	});
};

const try_quiz_again = (e) => {
	e.preventDefault();
	if (window.location.href.includes("new-submission")) {
		const target = $(e.currentTarget);
		window.location.href = `/quiz-submission/
		${target.data("quiz")}/
		${target.data("submission")}`;
	} else {
		window.location.reload();
	}
};

const check_answer = (e = undefined) => {
	e && e.preventDefault();

	let answer = $(".active-question textarea");
	if (answer.length && !answer.val().trim()) {
		frappe.throw(__("Please enter your answer"));
	}

	clearInterval(self.timer);
	$(".timer").addClass("hide");

	let total_questions = $(".question").length;
	let current_index = $(".active-question").attr("data-qt-index");

	$(".explanation").removeClass("hide");
	$("#check").addClass("hide");

	if (current_index == total_questions) {
		$("#summary").removeClass("hide");
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
	$(element).closest(".option").addClass("hide");
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
