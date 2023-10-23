frappe.ready(() => {
	if ($(".questions-table").length) {
		frappe.require("controls.bundle.js", () => {
			create_questions_table();
		});
	}

	$(".btn-save-quiz").click((e) => {
		save_quiz();
	});

	$(".question-row").click((e) => {
		edit_question(e);
	});

	$(document).on("click", ".questions-table .link-btn", (e) => {
		e.preventDefault();
		fetch_question_data(e);
	});
});

const show_question_modal = (values = {}) => {
	let fields = get_question_fields(values);

	this.question_dialog = new frappe.ui.Dialog({
		title: __("Add Question"),
		fields: fields,
		primary_action: (data) => {
			if (values) data.name = values.name;
			save_question(data);
		},
	});

	question_dialog.show();
};

const get_question_fields = (values = {}) => {
	if (!values.question) values = {};

	let dialog_fields = [
		{
			fieldtype: "Text Editor",
			fieldname: "question",
			label: __("Question"),
			reqd: 1,
			default: values.question || "",
		},
		{
			fieldtype: "Select",
			fieldname: "type",
			label: __("Type"),
			options: ["Choices", "User Input"],
			default: values.type || "Choices",
		},
	];
	Array.from({ length: 4 }, (x, i) => {
		num = i + 1;

		dialog_fields.push({
			fieldtype: "Section Break",
			fieldname: `section_break_${num}`,
		});

		let option = {
			fieldtype: "Small Text",
			fieldname: `option_${num}`,
			label: __("Option") + ` ${num}`,
			depends_on: "eval:doc.type=='Choices'",
			default: values[`option_${num}`] || "",
		};

		if (num <= 2) option.mandatory_depends_on = "eval:doc.type=='Choices'";

		dialog_fields.push(option);
		console.log(dialog_fields);

		dialog_fields.push({
			fieldtype: "Data",
			fieldname: `explanaion_${num}`,
			label: __("Explanation"),
			depends_on: "eval:doc.type=='Choices'",
			default: values[`explanaion_${num}`] || "",
		});

		let is_correct = {
			fieldtype: "Check",
			fieldname: `is_correct_${num}`,
			label: __("Is Correct"),
			depends_on: "eval:doc.type=='Choices'",
			default: values[`is_correct_${num}`] || 0,
		};

		if (num <= 2)
			is_correct.mandatory_depends_on = "eval:doc.type=='Choices'";

		dialog_fields.push(is_correct);

		possibility = {
			fieldtype: "Small Text",
			fieldname: `possibility_${num}`,
			label: __("Possible Answer") + ` ${num}`,
			depends_on: "eval:doc.type=='User Input'",
			default: values[`possibility_${num}`] || "",
		};

		if (num == 1)
			possibility.mandatory_depends_on = "eval:doc.type=='User Input'";

		dialog_fields.push(possibility);
	});

	return dialog_fields;
};

const edit_question = (e) => {
	let question = $(e.currentTarget).data("question");
	frappe.call({
		method: "lms.lms.doctype.lms_quiz.lms_quiz.get_question_details",
		args: {
			question: question,
		},
		callback: (data) => {
			if (data.message) show_question_modal(data.message);
		},
	});
};

const save_quiz = (values) => {
	validate_mandatory();
	validate_questions();

	frappe.call({
		method: "lms.lms.doctype.lms_quiz.lms_quiz.save_quiz",
		args: {
			quiz_title: $("#quiz-title").val(),
			max_attempts: $("#max-attempts").val(),
			passing_percentage: $("#passing-percentage").val(),
			quiz: $("#quiz-form").data("name") || "",
			questions: this.table.get_value("questions"),
			show_answers: $("#show-answers").is(":checked") ? 1 : 0,
			show_submission_history: $("#show-submission-history").is(
				":checked"
			)
				? 1
				: 0,
		},
		callback: (data) => {
			frappe.show_alert({
				message: __("Saved"),
				indicator: "green",
			});
			setTimeout(() => {
				window.location.href = `/quizzes/${data.message}`;
			}, 2000);
		},
	});
};

const validate_mandatory = () => {
	let fields = ["#quiz-title", "#passing-percentage"];
	fields.forEach((field, idx) => {
		if (!$(field).val()) {
			let error = $("p")
				.addClass("error-message")
				.text(__("Please enter a value"));
			$(error).insertAfter(field);
			scroll_to_element($(field));
			throw "This field is mandatory";
		}
	});
};

const validate_questions = () => {
	let questions = this.table.get_value("questions");

	if (!questions.length) {
		frappe.throw(__("Please add a question."));
	}

	questions.forEach((question, index) => {
		if (!question.question) {
			frappe.throw(__("Please add question in row") + " " + (index + 1));
		}

		if (!question.marks) {
			frappe.throw(__("Please add marks in row") + " " + (index + 1));
		}
	});
};

const scroll_to_element = (element) => {
	if ($(element).length) {
		$([document.documentElement, document.body]).animate(
			{
				scrollTop: $(element).offset().top - 100,
			},
			1000
		);
	}
};

const save_question = (values) => {
	frappe.call({
		method: "lms.lms.doctype.lms_quiz.lms_quiz.save_question",
		args: {
			quiz: $("#quiz-form").data("name") || "",
			values: values,
			index: $("#quiz-form").data("index") + 1,
		},
		callback: (data) => {
			if (data.message) this.question_dialog.hide();

			if (values.name) {
				frappe.show_alert({
					message: __("Saved"),
					indicator: "green",
				});
				setTimeout(() => {
					window.location.reload();
				}, 1000);
			} else {
				let details = {
					question: data.message,
				};
				index = this.table.get_value("questions").length;
				add_question_row(details, index);
			}
		},
	});
};

const create_questions_table = () => {
	this.table = new frappe.ui.FieldGroup({
		fields: [
			{
				fieldname: "questions",
				fieldtype: "Table",
				in_place_edit: 1,
				label: __("Questions"),
				fields: [
					{
						fieldname: "question",
						fieldtype: "Link",
						label: __("Question"),
						options: "LMS Question",
						in_list_view: 1,
						only_select: 1,
						reqd: 1,
					},
					{
						fieldname: "marks",
						fieldtype: "Int",
						label: __("Marks"),
						in_list_view: 1,
						reqd: 1,
					},
					{
						fieldname: "question_name",
						fieldname: "Link",
						options: "LMS Quiz Question",
						label: __("Question Name"),
					},
				],
			},
		],
		body: $(".questions-table").get(0),
	});
	this.table.make();
	$(".questions-table .form-section:last").removeClass("empty-section");
	$(".questions-table .frappe-control").removeClass("hide-control");
	$(".questions-table .form-column").addClass("p-0");

	quiz_questions.forEach((question, idx) => {
		add_question_row(question, idx);
	});
	this.table.fields_dict["questions"].grid.add_custom_button(
		"New Question",
		show_question_modal,
		"bottom"
	);
};

const add_question_row = (question, idx) => {
	this.table.fields_dict["questions"].grid.add_new_row();
	this.table.get_value("questions")[idx] = {
		question: question.question,
		marks: question.marks,
	};
	this.table.refresh();
};

const fetch_question_data = (e) => {
	let question_name = $(e.currentTarget)
		.find(".btn-open")
		.attr("href")
		.split("/")[3];

	frappe.call({
		method: "lms.lms.doctype.lms_question.lms_question.get_question_details",
		args: {
			question: question_name,
		},
		callback: (data) => {
			show_question_modal(data.message);
		},
	});
};
