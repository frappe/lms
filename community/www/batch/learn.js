frappe.ready(() => {

  /* Save Lesson Progress */
  if ($(".title").attr("data-membership") && !$(".title").hasClass("is_mentor")) {
    frappe.call({
      method: "community.lms.doctype.lesson.lesson.save_progress",
      args: {
        lesson: $(".title").attr("data-lesson"),
        course: $(".title").attr("data-course")
      }
    })
  }

  /* Save Current Lesson */
  if ($(".title").attr("data-membership")) {
    frappe.call("community.lms.api.save_current_lesson", {
      course_name: $(".title").attr("data-course"),
      lesson_name: $(".title").attr("data-lesson")
    })
  }

  /* Submit Quiz */
  $("#submit-quiz").click((e) => {
    e.preventDefault();
    console.log("click")
    var result = [];
    $('.question').each((i, element) => {
      var options = $(element).find(".option");
      var answers = [];
      options.filter((i, op) => $(op).prop("checked")).each((i, elem) => answers.push(decodeURIComponent(elem.value)));
      result.push({
        "question": element.dataset.question,
        "answer": answers
      });
    });
    frappe.call({
      method: "community.lms.doctype.lms_quiz.lms_quiz.submit",
      args: {
        quiz: $("#title").text(),
        result: result
      },
      callback: (data) => {
        $("#submit-quiz").addClass("hide");
        $("#try-again").removeClass("hide");
        $(":input[type='checkbox']").prop("disabled", true);
        $(":input[type='radio']").prop("disabled", true);
        if (data.message == result.length) {
          $(".success-message").text("Congratulations, you cleared the quiz!");
        }
        else {
          $(".success-message").text("Some of your answers weren't correct. You can give it another shot.");
        }
        $(".score").text(`Score: ${data.message}/${result.length}`);
      }
    })
  })

  /* Try the quiz again */
  $("#try-again").click((e) => {
    e.preventDefault();
    $(":input[type='checkbox']").prop("disabled", false);
    $(":input[type='radio']").prop("disabled", false);
    $("#quiz-form").trigger("reset");
    $(".success-message").text("");
    $(".score").text("");
    $("#submit-quiz").removeClass("hide");
    $("#try-again").addClass("hide");
  })
})
