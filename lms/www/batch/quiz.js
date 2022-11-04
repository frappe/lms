frappe.ready(() => {
	if (!$(".quiz-card").length) {
		add_question();
	}

	$(".btn-question").click((e) => {
		add_question();
	});

	$(".btn-save-question").click((e) => {
		save_question(e);
	});

	$(".copy-quiz-id").click((e) => {
		frappe.utils.copy_to_clipboard($(e.currentTarget).data("name"));
	});

	get_questions();
});

const add_question = () => {
	/* if ($(".new-quiz-card").length) {
        scroll_to_question_container();
        return;
    } */

	let add_after = $(".quiz-card").length
		? $(".quiz-card:last")
		: $("#quiz-title");
	let question_template = `<div class="quiz-card new-quiz-card">
            <div contenteditable="true" data-placeholder="${__(
				"Question"
			)}" class="question mb-4"></div>
        </div>`;
	$(question_template).insertAfter(add_after);
	get_question_template();
	$(".btn-save-question").removeClass("hide");
};

const get_question_template = () => {
	Array.from({ length: 4 }, (x, num) => {
		let option_template = get_option_template(num + 1);
		let add_after = $(".quiz-card:last .option-group").length
			? $(".quiz-card:last .option-group").last()
			: $(".question:last");
		question_template = $(option_template).insertAfter(add_after);
	});
};

const get_option_template = (num) => {
	return `<div class="option-group mt-4">
                <label class="">${__("Option")} ${num}</label>
                <div class="d-flex justify-content-between option-${num}">
                    <div contenteditable="true" data-placeholder="${__(
						"Option"
					)}"
                        class="option-input"></div>
                    <div contenteditable="true" data-placeholder="${__(
						"Explanation"
					)}"
                        class="option-input"></div>
                    <div class="option-checkbox">
                        <input type="checkbox">
                        <label class="mb-0"> ${__("Is Correct")} </label>
                    </div>
                </div>
            </div>`;
};

const save_question = (e) => {
	if (!$("#quiz-title").text()) {
		frappe.throw(__("Quiz Title is mandatory."));
	}

	frappe.call({
		method: "lms.lms.doctype.lms_quiz.lms_quiz.save_quiz",
		args: {
			quiz_title: $("#quiz-title").text(),
			questions: get_questions(),
			quiz: $("#quiz-title").data("name") || "",
		},
		callback: (data) => {
			window.location.href = "/quizzes";
		},
	});
};

const get_questions = () => {
	let questions = [];

	$(".quiz-card").each((i, el) => {
		if (!$(el).find(".question").text()) return;

		let details = {};
		let one_correct_option = false;
		details["question"] = $(el).find(".question").text();
		details["question_name"] =
			$(el).find(".question").data("question") || "";

		Array.from({ length: 4 }, (x, i) => {
			let num = i + 1;

			details[`option_${num}`] = $(el)
				.find(`.option-${num} .option-input:first`)
				.text();
			details[`explanation_${num}`] = $(el)
				.find(`.option-${num} .option-input:last`)
				.text();

			let is_correct = $(el)
				.find(`.option-${num} .option-checkbox`)
				.find("input")
				.prop("checked");
			if (is_correct) one_correct_option = true;

			details[`is_correct_${num}`] = is_correct;
		});

		if (!details["option_1"] || !details["option_2"])
			frappe.throw(__("Each question must have at least two options."));

		if (!one_correct_option)
			frappe.throw(
				__("Each question must have at least one correct option.")
			);

		questions.push(details);
	});

	return questions;
};

const scroll_to_question_container = () => {
	$([document.documentElement, document.body]).animate(
		{
			scrollTop: $(".new-quiz-card").offset().top,
		},
		1000
	);
	$(".new-quiz-card").find(".question").focus();
};
