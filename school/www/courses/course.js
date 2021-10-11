frappe.ready(() => {
  if (frappe.session.user != "Guest") {
    check_mentor_request();
  }

  hide_wrapped_mentor_cards();

  $("#apply-now").click((e) => {
    create_mentor_request(e);
  });

  $("#cancel-request").click((e) => {
    cancel_mentor_request(e);
  });

  $(".join-batch").click((e) => {
    join_course(e)
  });

  $(".view-all-mentors").click((e) => {
    view_all_mentors(e);
  });

  $(".video-preview").click((e) => {
    show_video_dialog(e);
  });

  $(".review-link").click((e) => {
    show_review_dialog(e);
  });

  $(".icon-rating").click((e) => {
    highlight_rating(e);
  });

  $("#submit-review").click((e) => {
    submit_review(e);
  })

  $("#notify-me").click((e) => {
    notify_user(e);
  })

})

var check_mentor_request = () => {
  frappe.call({
    'method': 'school.lms.doctype.lms_mentor_request.lms_mentor_request.has_requested',
    'args': {
      course: decodeURIComponent($("#course-title").attr("data-course")),
    },
    'callback': (data) => {
      if (data.message > 0) {
        $("#mentor-request").addClass("hide");
        $("#already-applied").removeClass("hide")
      }
    }
  })
}

var hide_wrapped_mentor_cards = () => {
  var offset_top_prev;

  $(".mentors-section .member-card").each(function () {
    var offset_top = $(this).offset().top;
    if (offset_top > offset_top_prev) {
      $(this).addClass('wrapped').slideUp("fast");
    }
    if (!offset_top_prev) {
      offset_top_prev = offset_top;
    }

  });

  if ($(".wrapped").length < 1) {
    $(".view-all-mentors").hide();
  }
}

var create_mentor_request = (e) => {
  e.preventDefault();
  if (frappe.session.user == "Guest") {
    window.location.href = `/login?redirect-to=/courses/${$(e.currentTarget).attr("data-course")}`;
    return;
  }
  frappe.call({
    "method": "school.lms.doctype.lms_mentor_request.lms_mentor_request.create_request",
    "args": {
      "course": decodeURIComponent($(e.currentTarget).attr("data-course"))
    },
    "callback": (data) => {
      if (data.message == "OK") {
        $("#mentor-request").addClass("hide");
        $("#already-applied").removeClass("hide")
      }
    }
  })
}

var cancel_mentor_request = (e) => {
  e.preventDefault()
  frappe.call({
    "method": "school.lms.doctype.lms_mentor_request.lms_mentor_request.cancel_request",
    "args": {
      "course": decodeURIComponent($(e.currentTarget).attr("data-course"))
    },
    "callback": (data) => {
      if (data.message == "OK") {
        $("#mentor-request").removeClass("hide");
        $("#already-applied").addClass("hide")
      }
    }
  })
}

var join_course = (e) => {
  e.preventDefault();
  var course = $(e.currentTarget).attr("data-course")
  if (frappe.session.user == "Guest") {
    window.location.href = `/login?redirect-to=/courses/${course}`;
    return;
  }
  var batch = $(e.currentTarget).attr("data-batch");
  batch = batch ? decodeURIComponent(batch) : "";
  frappe.call({
    "method": "school.lms.doctype.lms_batch_membership.lms_batch_membership.create_membership",
    "args": {
      "batch": batch ? batch : "",
      "course": course
    },
    "callback": (data) => {
      if (data.message == "OK") {
        frappe.msgprint(__("You are now a student of this course."));
        setTimeout(function () {
          window.location.href = `/courses/${course}/learn/1.1`;
        }, 2000);
      }
    }
  })
}

var view_all_mentors = (e) => {
  $(".wrapped").each((i, element) => {
    $(element).slideToggle("slow");
  })
  var text_element = $(".view-all-mentors .course-instructor .all-mentors-text");
  var text = text_element.text() == "View all mentors" ? "View less" : "View all mentors";
  text_element.text(text);

  if ($(".mentor-icon").css("transform") == "none") {
    $(".mentor-icon").css("transform", "rotate(180deg)");
  } else {
    $(".mentor-icon").css("transform", "");
  }
}

var show_video_dialog = (e) => {
  e.preventDefault();
  $("#video-modal").modal("show");
}

var show_review_dialog = (e) => {
  e.preventDefault();
  $("#review-modal").modal("show");
}

var highlight_rating = (e) => {
  var rating = $(e.currentTarget).attr("data-rating");
  $(".icon-rating").removeClass("star-click");
  $(".icon-rating").each((i, elem) => {
    if (i <= rating-1) {
      $(elem).addClass("star-click");
    }
  })
}

var submit_review = (e) => {
  e.preventDefault();
  var rating = $(".rating-field").children(".star-click").length;
  var review = $(".review-field").val();
  if (!review || !rating) {
    $(".error-field").text("Both Rating and Review are required.");
    return;
  }
  frappe.call({
    method: "school.lms.doctype.lms_course_review.lms_course_review.submit_review",
    args: {
      "rating": rating,
      "review": review,
      "course": decodeURIComponent($(e.currentTarget).attr("data-course"))
    },
    callback: (data) => {
      if (data.message == "OK") {
        $(".review-modal").modal("hide");
        frappe.msgprint("Thanks for providing your feedback!");
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    }
  })
}

var notify_user = (e) => {
  e.preventDefault();
  var course = decodeURIComponent($(e.currentTarget).attr("data-course"));
  if (frappe.session.user == "Guest") {
    window.location.href = `/login?redirect-to=/courses/${course}`;
    return;
  }

  frappe.call({
    method: "school.lms.doctype.lms_course_interest.lms_course_interest.capture_interest",
    args: {
      "course": course
    },
    callback: (data) => {
      frappe.msgprint(__("Your interest has been noted. We'll notify you via email when this course becomes available."));
      $("#notify-me").attr("disabled", true).attr("title", "Your interest has already been noted");
    }
  })
}
