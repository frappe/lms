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

	$(document).on("change", ".type", function () {
		toggle_form($(this));
	});

	get_questions();
});

const toggle_form = (el) => {
	let type = el.val();
	if (type === "Choices") {
		el.siblings(".option-group").removeClass("hide");
		el.siblings(".possibility-group").addClass("hide");
	} else if (type === "User Input") {
		el.siblings(".option-group").addClass("hide");
		el.siblings(".possibility-group").removeClass("hide");
	}
};

const add_question = () => {
	let add_after = $(".quiz-card").length
		? $(".quiz-card:last")
		: $("#quiz-title");
	let question_template = `<div class="quiz-card new-quiz-card">
            <div contenteditable="true" data-placeholder="${__(
				"Question"
			)}" class="question mb-4"></div>
			<select value="{{ question.type }}" class="input-with-feedback form-control ellipsis type" maxlength="140" data-fieldtype="Select" data-fieldname="type" placeholder="" data-doctype="LMS Quiz Question">
				<option value="Choices"> ${__("Choices")} </option>
				<option value="User Input"> ${__("User Input")} </option>
			</select>
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
			: $(".type:last");
		question_template = $(option_template).insertAfter(add_after);
	});

	Array.from({ length: 4 }, (x, num) => {
		let possibility_template = get_possibility_template(num + 1);
		let add_after = $(".quiz-card:last .possibility-group").length
			? $(".quiz-card:last .possibility-group").last()
			: $(".quiz-card:last .option-group:last");
		question_template = $(possibility_template).insertAfter(add_after);
	});
};

const get_possibility_template = (num) => {
	return `<div class="possibility-group mt-4 hide">
			<label class=""> ${__("Possible Answer")} ${num} </label>
			<div class="control-input-wrapper">
				<div class="control-input">
					<div contenteditable="true" class="input-with-feedback form-control bold possibility-{{ num }}" style="height: 100px;" spellcheck="false"></div>
				</div>
			</div>
		</div>`;
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
		let correct_options = 0;
		let possibilities = 0;

		details["element"] = el;
		details["question"] = $(el).find(".question").text();
		details["question_name"] =
			$(el).find(".question").data("question") || "";
		details["type"] = $(el).find(".type").val();

		Array.from({ length: 4 }, (x, i) => {
			let num = i + 1;

			if (details.type == "Choices") {
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
				if (is_correct) correct_options += 1;

				details[`is_correct_${num}`] = is_correct;
			} else {
				let possible_answer = $(el)
					.find(`.possibility-${num}`)
					.text()
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
	scroll_to_element(".new-quiz-card:last");
	$(".new-quiz-card").find(".question").focus();
};

const scroll_to_element = (element) => {
	if ($(element).length)
		$([document.documentElement, document.body]).animate(
			{
				scrollTop: $(element).offset().top,
			},
			1000
		);
};
