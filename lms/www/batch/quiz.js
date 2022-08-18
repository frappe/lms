frappe.ready(() => {

    $(".btn-question").click((e) => {
        add_question(e);
    });

    $(".btn-save-question").click((e) => {
        save_question(e);
    });

});


const add_question = (e) => {
    let add_after = $(".quiz-card").length ? $(".quiz-card") : $("#quiz-title");
    let question_template = `<div class="quiz-card">
            <div contenteditable="true" data-placeholder="${__("Question")}" class="question mb-4"></div>
        </div>`;
    $(question_template).insertAfter(add_after);
    get_question_template();
    $(".btn-save-question").removeClass("hide");
};


const get_question_template = () => {
    Array.from({length: 4}, (x, num) => {
        let option_template = get_option_template(num + 1);
        let add_after = $(".quiz-card:last .option-group").length ? $(".quiz-card:last .option-group").last() : $(".question:last");
        question_template = $(option_template).insertAfter(add_after);
    });
};


const get_option_template = (num) => {
    return `<div class="option-group mt-4">
                <label class="">${__("Option")} ${num}</label>
                <div class="d-flex justify-content-between option-${num}">
                    <div contenteditable="true" data-placeholder="${ __("Option") }"
                        class="option-input"></div>
                    <div contenteditable="true" data-placeholder="${ __('Explanation') }"
                        class="option-input"></div>
                    <div class="option-checkbox">
                        <input type="checkbox">
                        <label class="mb-0"> ${ __("Is Correct") } </label>
                    </div>
                </div>
            </div>`;
};


const save_question = (e) => {
    if (!$("#quiz-title").text()) {
        frappe.throw(__("Quiz Title is mandatory."));
    }
    console.log(get_questions());
    debugger;
    frappe.call({
        method: lms.lms.doctype.lms_quiz.lms_quiz.save_quiz,
        args: {
            "quiz-title": $("#quiz-title"),
            "questions": get_questions()
        },
        callback: (data) => {

        }
    });
};


const get_questions = () => {
    let questions = [];

    $(".quiz-card").each((i, elem) => {

        if (!$(elem).find(".question").text())
            return;

        let question_details = {};
        question_details["question"] = $(elem).find(".question").text();

        Array.from({length: 4}, (x, i) => {
            let num = i + 1;
            question_details[`option_${num}`] =  $(`.option-${num} .option-input:first`).text();
            question_details[`explanation_${num}`] =  $(`.option-${num} .option-input:last`).text();
            question_details[`is_correct_${num}`] = $(`.option-${num} .option-checkbox`).find("input").prop("checked");
        });
        questions.push(question_details);
    });

    return questions
};
