frappe.ready(() => {

  save_current_lesson();

  $("#progress").click((e) => {
    mark_progress(e);
  });

  $("#submit-quiz").click((e) => {
    submit_quiz(e);
  });

  $("#try-again").click((e) => {
    try_quiz_again(e);
  });

})

var save_current_lesson = () => {
  if ($(".title").hasClass("is-member")) {
    frappe.call("community.lms.api.save_current_lesson", {
      course_name: $(".title").attr("data-course"),
      lesson_name: $(".title").attr("data-lesson")
    })
  }
}

var mark_progress = (e) => {
  var status = $(e.currentTarget).attr("data-progress");
  frappe.call({
    method: "community.lms.doctype.lesson.lesson.save_progress",
    args: {
      lesson: $(".title").attr("data-lesson"),
      course: $(".title").attr("data-course"),
      status: status
    },
    callback: (data) => {
      if (data.message == "OK") {
        change_progress_indicators(status, e);
      }
    }
  })
}

var change_progress_indicators = (status, e) => {
  if (status == "Complete") {
    $(".lesson-progress").removeClass("hide");
    $(".active-lesson .lesson-progress-tick").removeClass("hide");
  }
  else {
    $(".lesson-progress").addClass("hide");
    $(".active-lesson .lesson-progress-tick").addClass("hide");
  }
  var label = status != "Complete" ? "Mark as Complete" : "Mark as Incomplete";
  var data_progress = status != "Complete" ? "Complete" : "Incomplete";
  $(e.currentTarget).text(label).attr("data-progress", data_progress);
}

var submit_quiz = (e) => {
  e.preventDefault();
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
}

var try_quiz_again = (e) => {
  e.preventDefault();
  $(":input[type='checkbox']").prop("disabled", false);
  $(":input[type='radio']").prop("disabled", false);
  $("#quiz-form").trigger("reset");
  $(".success-message").text("");
  $(".score").text("");
  $("#submit-quiz").removeClass("hide");
  $("#try-again").addClass("hide");
}
