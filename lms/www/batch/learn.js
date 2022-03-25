frappe.ready(() => {

  localStorage.removeItem($("#quiz-title").text());
  fetch_assignments();

  save_current_lesson();

  $(".option").click((e) => {
    enable_check(e);
  })

  $(".mark-progress").click((e) => {
    mark_progress(e);
  });

  $(".next").click((e) => {
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
  });

  $(".submit-work").click((e) => {
    attach_work(e);
  });

  $(".clear-work").click((e) => {
    clear_work(e);
  });

});

const save_current_lesson = () => {
  if ($(".title").hasClass("is-member")) {
    frappe.call("lms.lms.api.save_current_lesson", {
      course_name: $(".title").attr("data-course"),
      lesson_name: $(".title").attr("data-lesson")
    })
  }
};

const enable_check = (e) => {
  if ($(".option:checked").length) {
    $("#check").removeAttr("disabled");
    $(".custom-checkbox").removeClass("active-option");
    $(".option:checked").closest(".custom-checkbox").addClass("active-option");
  }
};

const mark_active_question = (e = undefined) => {
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
};

const mark_progress = (e) => {
  /* Prevent default only for Next button anchor tag and not for progress checkbox */
  if ($(e.currentTarget).prop("nodeName") != "INPUT")
    e.preventDefault();
  else
    return

  const target = $(e.currentTarget).attr("data-progress") ? $(e.currentTarget) : $("input.mark-progress");
  const current_status = $(".lesson-progress").hasClass("hide") ? "Incomplete": "Complete";

  let status = "Incomplete";
  if (target.prop("nodeName") == "INPUT" && target.prop("checked")) {
    status = "Complete";
  }

  if (status != current_status) {
    frappe.call({
      method: "lms.lms.doctype.course_lesson.course_lesson.save_progress",
      args: {
        lesson: $(".title").attr("data-lesson"),
        course: $(".title").attr("data-course"),
        status: status
      },
      callback: (data) => {
        change_progress_indicators(status, e);
        show_certificate_if_course_completed(data);
        move_to_next_lesson(status, e);
      }
    });
  }
  else
    move_to_next_lesson(status, e);
};

const change_progress_indicators = (status, e) => {
  if (status == "Complete") {
    $(".lesson-progress").removeClass("hide");
    $(".active-lesson .lesson-progress-tick").removeClass("hide");
  }
  else {
    $(".lesson-progress").addClass("hide");
    $(".active-lesson .lesson-progress-tick").addClass("hide");
  }
  if (status == "Incomplete" && !$(e.currentTarget).hasClass("next")) {
    $(e.currentTarget).addClass("hide");
    $("input.mark-progress").prop("checked", false).closest(".custom-checkbox").removeClass("hide");
  }
};

const show_certificate_if_course_completed = (data) => {
  if (data.message == 100 && !$(".next").attr("data-next") && $("#certification").hasClass("hide")) {
    $("#certification").removeClass("hide");
    $(".next").addClass("hide");
  }
};

const move_to_next_lesson = (status, e) => {
  if ($(e.currentTarget).hasClass("next") && $(e.currentTarget).attr("data-href")) {
    window.location.href = $(e.currentTarget).attr("data-href");
  }
  else if (status == "Complete") {
    $("input.mark-progress").closest(".custom-checkbox").addClass("hide");
    $("div.mark-progress").removeClass("hide");
    $(".next").addClass("hide");
  }
  else {
    $("input.mark-progress").closest(".custom-checkbox").removeClass("hide");
    $("div.mark-progress").addClass("hide");
    $(".next").removeClass("hide");
  }
};

const quiz_summary = (e) => {
  e.preventDefault();
  var quiz_name = $("#quiz-title").text();
  var total_questions = $(".question").length;

  frappe.call({
    method: "lms.lms.doctype.lms_quiz.lms_quiz.quiz_summary",
    args: {
      "quiz": quiz_name,
      "results": localStorage.getItem(quiz_name)
    },
    callback: (data) => {
      var message = data.message == total_questions ? "Excellent Work" : "You were almost there."
      $(".question").addClass("hide");
      $("#summary").addClass("hide");
      $("#quiz-form").parent().prepend(
        `<div class="text-center summary"><h2>${message} 👏 </h2>
          <div class="font-weight-bold">${data.message}/${total_questions} correct.</div></div>`);
      $("#try-again").removeClass("hide");
    }
  })
};

const try_quiz_again = (e) => {
  window.location.reload();
};

const check_answer = (e) => {
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
};

const parse_options = () => {
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
};

const add_icon = (element, icon) => {
  $(element).closest(".custom-checkbox").removeClass("active-option");
  var label = $(element).siblings(".option-text").text();
  $(element).parent().empty().html(`<div class="option-text"><img class="mr-3" src="/assets/lms/icons/${icon}.svg"> ${label}</div>`);
};

const add_to_local_storage = (quiz_name, current_index, answer, is_correct) => {
  var quiz_stored = JSON.parse(localStorage.getItem(quiz_name));
  var quiz_obj = {
    "question_index": current_index,
    "answer": answer.join(),
    "is_correct": is_correct
  }
  quiz_stored ? quiz_stored.push(quiz_obj) : quiz_stored = [quiz_obj]
  localStorage.setItem(quiz_name, JSON.stringify(quiz_stored))
};

const create_certificate = (e) => {
  e.preventDefault();
  course = $(".title").attr("data-course");
  frappe.call({
    method: "lms.lms.doctype.lms_certification.lms_certification.create_certificate",
    args: {
      "course": course
    },
    callback: (data) => {
      window.location.href = `/courses/${course}/${data.message.name}`;
    }
  })
};

const attach_work = (e) => {
  const target = $(e.currentTarget);
  let files = target.siblings(".attach-file").prop("files")
  if (files && files.length) {
    files = add_files(files)
    return_as_dataurl(files)
    files.map((file) => {
      upload_file(file, target);
    })
  }
};

const upload_file = (file, target) => {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();

    xhr.onreadystatechange = () => {
      if (xhr.readyState == XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          let response = JSON.parse(xhr.responseText)
          create_lesson_work(response.message, target);
        } else if (xhr.status === 403) {
          let response = JSON.parse(xhr.responseText);
          frappe.msgprint(`Not permitted. ${response._error_message || ''}`);

        } else if (xhr.status === 413) {
          frappe.msgprint('Size exceeds the maximum allowed file size.');

        } else {
          frappe.msgprint(xhr.status === 0 ? 'XMLHttpRequest Error' : `${xhr.status} : ${xhr.statusText}`);
        }
      }
    }
    xhr.open('POST', '/api/method/upload_file', true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('X-Frappe-CSRF-Token', frappe.csrf_token);

    let form_data = new FormData();
    if (file.file_obj) {
      form_data.append('file', file.file_obj, `${frappe.session.user}-${file.name}`);
      form_data.append('folder', `${$(".title").attr("data-lesson")} ${$(".title").attr("data-course")}`)
    }

    xhr.send(form_data);
  });
}

const create_lesson_work = (file, target) => {
  frappe.call({
    method: "lms.lms.doctype.lesson_assignment.lesson_assignment.upload_assignment",
    args: {
      assignment: file.file_url,
      lesson: $(".title").attr("data-lesson"),
      identifier: target.siblings(".attach-file").attr("id")
    },
    callback: (data) => {
      target.siblings(".attach-file").addClass("hide");
      target.siblings(".preview-work").removeClass("hide");
      target.siblings(".preview-work").find("a").attr("href", file.file_url).text(file.file_name)
      target.addClass("hide");
    }
  });
};

const return_as_dataurl = (files) => {
  let promises = files.map(file =>
    frappe.dom.file_to_base64(file.file_obj)
      .then(dataurl => {
        file.dataurl = dataurl;
        this.on_success && this.on_success(file);
      })
  );
  return Promise.all(promises);
}

const add_files = (files) => {
  files = Array.from(files).map(file => {
    let is_image = file.type.startsWith('image');
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
      private: !is_image
    }
  });
  return files
};

const clear_work = (e) => {
  const target = $(e.currentTarget);
  const parent = target.closest(".preview-work");
  parent.addClass("hide");
  parent.siblings(".attach-file").removeClass("hide").val(null);
  parent.siblings(".submit-work").removeClass("hide");
};

const fetch_assignments = () => {
  if ($(".attach-file").length <= 0)
    return;
  frappe.call({
    method: "lms.lms.doctype.lesson_assignment.lesson_assignment.get_assignment",
    args: {
      "lesson": $(".title").attr("data-lesson")
    },
    callback: (data) => {
      if (data.message && data.message.length) {
        const assignments = data.message;
        for (let i in assignments) {
          let target = $(`#${assignments[i]["id"]}`);
          target.addClass("hide");
          target.siblings(".submit-work").addClass("hide");
          target.siblings(".preview-work").removeClass("hide");
          target.siblings(".preview-work").find("a").attr("href", assignments[i]["assignment"]).text(assignments[i]["file_name"]);
        }
      }
    }
  });
};
