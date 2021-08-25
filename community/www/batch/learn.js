frappe.ready(() => {

  localStorage.removeItem($("#quiz-title").text());

  save_current_lesson();

  $(".option").click((e) => {
    enable_check(e);
  })

  $("#progress").click((e) => {
    mark_progress(e);
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
  })

})

var save_current_lesson = () => {
  if ($(".title").hasClass("is-member")) {
    frappe.call("community.lms.api.save_current_lesson", {
      course_name: $(".title").attr("data-course"),
      lesson_name: $(".title").attr("data-lesson")
    })
  }
}

var enable_check = (e) => {
  if ($(".option:checked").length && $("#check").attr("disabled")) {
    $("#check").removeAttr("disabled");
  }
}

var mark_active_question = (e = undefined) => {
  var current_index;
  var next_index = 1;
  if (e) {
    e.preventDefault();
    current_index = $(".active-question").attr("data-qt-index");
    next_index = parseInt(current_index) + 1;
  }
  $(".question").addClass("hide").removeClass("active-question");
  $(`.question[data-qt-index='${next_index}']`).removeClass("hide").addClass("active-question");
  $(".current-question").text(`${next_index}`);
  $("#check").removeClass("hide").attr("disabled", true);
  $("#next").addClass("hide");
  $(".explanation").addClass("hide");
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
      change_progress_indicators(status, e);
      if (data.message == 100 && !$(".next").length && $("#certification").hasClass("hide")) {
        $("#certification").removeClass("hide");
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

var quiz_summary = (e) => {
  e.preventDefault();
  var quiz_name = $("#quiz-title").text();
  var total_questions = $(".question").length;

  frappe.call({
    method: "community.lms.doctype.lms_quiz.lms_quiz.quiz_summary",
    args: {
      "quiz": quiz_name,
      "results": localStorage.getItem(quiz_name)
    },
    callback: (data) => {
      var message = data.message == total_questions ? "Excellent Work" : "You were almost there."
      $(".question").addClass("hide");
      $(".quiz-footer").addClass("hide");
      $("#quiz-form").parent().prepend(
        `<div class="text-center summary"><h2>${message} 👏 </h2>
          <div class="font-weight-bold">${data.message}/${total_questions} correct.</div></div>`);
      $("#try-again").removeClass("hide");
    }
  })
}

var try_quiz_again = (e) => {
  window.location.reload();
}

var check_answer = (e) => {
  e.preventDefault();

  var quiz_name = $("#quiz-title").text();
  var total_questions = $(".question").length;
  var current_index = $(".active-question").attr("data-qt-index");

  $(".explanation").removeClass("hide");
  $("#check").addClass("hide");

  if (current_index == total_questions) {
    if ($(".eligible-for-submission").length) {
      $("#summary").removeClass("hide")
    }
    else {
      $("#submission-message").removeClass("hide");
    }
  }
  else {
    $("#next").removeClass("hide")
  }

  var [answer, is_correct] = parse_options();
  add_to_local_storage(quiz_name, current_index, answer, is_correct)
}

var parse_options = () => {
  var answer = [];
  var is_correct = [];
  $(".active-question input").each((i, element) => {
    var correct = parseInt($(element).attr("data-correct"));
    if ($(element).prop("checked")) {
      answer.push(decodeURIComponent($(element).val()));
      correct && is_correct.push(1);
      correct ? add_icon(element, "check") : add_icon(element, "wrong");
    }
    else {
      correct && is_correct.push(0);
      correct ? add_icon(element, "minus-circle-green") : add_icon(element, "minus-circle");
    }
  })
  return [answer, is_correct];
}

var add_icon = (element, icon) => {
  $(element).parent().empty().html(`<img class="mr-3" src="/assets/community/icons/${icon}.svg">`);
}

var add_to_local_storage = (quiz_name, current_index, answer, is_correct) => {
  var quiz_stored = JSON.parse(localStorage.getItem(quiz_name));
  var quiz_obj = {
    "question_index": current_index,
    "answer": answer.join(),
    "is_correct": is_correct
  }
  quiz_stored ? quiz_stored.push(quiz_obj) : quiz_stored = [quiz_obj]
  localStorage.setItem(quiz_name, JSON.stringify(quiz_stored))
}

var create_certificate = (e) => {
  e.preventDefault();
  course = $(".title").attr("data-course");
  frappe.call({
    method: "community.lms.doctype.lms_certification.lms_certification.create_certificate",
    args: {
      "course": course
    },
    callback: (data) => {
      window.location.href = `/courses/${course}/${data.message}`;
    }
  })
}
