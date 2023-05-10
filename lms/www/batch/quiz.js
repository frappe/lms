frappe.ready(() => {
	if ($(".question-card").length <= 1) {
		add_question();
	}

	$(".btn-add-question").click((e) => {
		add_question(true);
	});

	$(".btn-save-question").click((e) => {
		save_question(e);
	});

	$(".copy-quiz-id").click((e) => {
		frappe.utils.copy_to_clipboard($(e.currentTarget).data("name"));
	});

	$(document).on("click", ".question-type", (e) => {
		toggle_form($(e.currentTarget));
	});

	get_questions();
});

const toggle_form = (el) => {
	if ($(el).hasClass("active")) {
		let type = $(el).find("input").data("type");
		if (type == "Choices") {
			$(el)
				.closest(".field-parent")
				.find(".options-group")
				.removeClass("hide");
			$(el)
				.closest(".field-parent")
				.find(".answers-group")
				.addClass("hide");
		} else {
			$(el)
				.closest(".field-parent")
				.find(".options-group")
				.addClass("hide");
			$(el)
				.closest(".field-parent")
				.find(".answers-group")
				.removeClass("hide");
		}
	}
};

const add_question = (scroll = false) => {
	let template = $("#question-template").html();
	let index = $(".question-card:nth-last-child(2)").data("index") + 1 || 1;
	template = update_index(template, index);

	$(template).insertBefore($("#question-template"));
	scroll && scroll_to_question_container();
};

const update_index = (template, index) => {
	const $template = $(template);
	$template.attr("data-index", index);
	$template.find(".question-label").text("Question " + index);
	$template.find(".question-type input").attr("name", "type-" + index);
	return $template.prop("outerHTML");
};

const save_question = (e) => {
	if (!$("#quiz-title").val()) {
		frappe.throw(__("Quiz Title is mandatory."));
	}

	frappe.call({
		method: "lms.lms.doctype.lms_quiz.lms_quiz.save_quiz",
		args: {
			quiz_title: $("#quiz-title").val(),
			questions: get_questions(),
			quiz: $("#quiz-title").data("name") || "",
		},
		callback: (data) => {
			window.location.href = `/quizzes/${data.message}`;
		},
	});
};

const get_questions = () => {
	let questions = [];

	$(".field-parent").each((i, el) => {
		if (!$(el).find(".question").val()) return;
		let details = {};
		let correct_options = 0;
		let possibilities = 0;

		details["element"] = el;
		details["question"] = $(el).find(".question").val();
		details["question_name"] =
			$(el).find(".question").data("question") || "";
		details["type"] = $(el).find("label.active").find("input").data("type");

		Array.from({ length: 4 }, (x, i) => {
			let num = i + 1;

			if (details.type == "Choices") {
				details[`option_${num}`] = $(el).find(`.option-${num}`).val();

				details[`explanation_${num}`] = $(el)
					.find(`.explanation-${num}`)
					.val();

				let is_correct = $(el).find(`.correct-${num}`).prop("checked");

				if (is_correct) correct_options += 1;

				details[`is_correct_${num}`] = is_correct;
			} else {
				let possible_answer = $(el)
					.find(`.possibility-${num}`)
					.val()
					.trim();
				if (possible_answer) possibilities += 1;
				details[`possibility_${num}`] = possible_answer;
			}
		});
		validate_mandatory(details, correct_options, possibilities);

		details["multiple"] = correct_options > 1 ? 1 : 0;
		questions.push(details);
	});

	return questions;
};

const validate_mandatory = (details, correct_options, possibilities) => {
	if (details["type"] == "Choices") {
		if (!details["option_1"] || !details["option_2"]) {
			scroll_to_element(details["element"]);
			frappe.throw(__("Each question must have at least two options."));
		}

		if (!correct_options) {
			scroll_to_element(details["element"]);
			frappe.throw(
				__(
					"Question with choices must have at least one correct option."
				)
			);
		}
	} else if (!possibilities) {
		scroll_to_element(details["element"]);
		frappe.throw(
			__(
				"Question with user input must have at least one possible answer."
			)
		);
	}
};

const scroll_to_question_container = () => {
	scroll_to_element(".question-card:nth-last-child(2)");
	$(".question-card:nth-last-child(2)").find(".question").focus();
};

const scroll_to_element = (element) => {
	if ($(element).length)
		$([document.documentElement, document.body]).animate(
			{
				scrollTop: $(element).offset().top - 100,
			},
			1000
		);
};
