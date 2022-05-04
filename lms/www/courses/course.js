frappe.ready(() => {

    hide_wrapped_mentor_cards();

    $("#cancel-request").click((e) => {
        cancel_mentor_request(e);
    });

    $(".view-all-mentors").click((e) => {
        view_all_mentors(e);
    });

    $(".review-link").click((e) => {
        show_review_dialog(e);
    });

    $(".icon-rating").click((e) => {
        highlight_rating(e);
    });

    $("#submit-review").click((e) => {
        submit_review(e);
    });

    $("#certification").click((e) => {
        create_certificate(e);
    });

    $("#submit-for-review").click((e) => {
        submit_for_review(e);
    });

    $("#apply-certificate").click((e) => {
        apply_cetificate(e);
    });

    $("#slot-date").on("change", (e) => {
       display_slots(e);
    });

    $("#submit-slot").click((e) => {
        submit_slot(e);
    });

    $(".close-slot-modal").click((e) => {
        close_slot_modal(e);
    });

    $(document).on("click", ".slot", (e) => {
        select_slot(e);
    });

});

var hide_wrapped_mentor_cards = () => {
  var offset_top_prev;

  $(".member-parent .member-card").each(function () {
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

var cancel_mentor_request = (e) => {
  e.preventDefault()
  frappe.call({
    "method": "lms.lms.doctype.lms_mentor_request.lms_mentor_request.cancel_request",
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
  if (!rating) {
    $(".error-field").text("Please provide a rating.");
    return;
  }
  frappe.call({
    method: "lms.lms.doctype.lms_course_review.lms_course_review.submit_review",
    args: {
      "rating": rating,
      "review": review,
      "course": decodeURIComponent($(e.currentTarget).attr("data-course"))
    },
    callback: (data) => {
      if (data.message == "OK") {
        $(".review-modal").modal("hide");
        window.location.reload();
      }
    }
  })
};

const create_certificate = (e) => {
  e.preventDefault();
  course = $(e.currentTarget).attr("data-course");
  frappe.call({
    method: "lms.lms.doctype.lms_certificate.lms_certificate.create_certificate",
    args: {
      "course": course
    },
    callback: (data) => {
      window.location.href = `/courses/${course}/${data.message.name}`;
    }
  })
};

const element_not_in_viewport = (el) => {
  const rect = el.getBoundingClientRect();
  return rect.bottom < 0 || rect.right < 0 || rect.left > window.innerWidth || rect.top > window.innerHeight;
};

const submit_for_review = (e) => {
  let course = $(e.currentTarget).data("course");
  frappe.call({
    method: "lms.lms.doctype.lms_course.lms_course.submit_for_review",
    args: {
      "course": course
    },
    callback: (data) => {
      if (data.message == "No Chp") {
        frappe.msgprint(__(`There are no chapters in this course.
          Please add chapters and lessons to your course before you submit it for review.`));
      } else if (data.message == "OK") {
        frappe.msgprint(__("Your course has been submitted for review."))
        window.location.reload();
      }
    }
  })
};

const apply_cetificate = (e) => {
    $("#slot-modal").modal("show");


};

const submit_slot = (e) => {
    e.preventDefault();
    const slot = window.selected_slot;
    frappe.call({
        method: "lms.lms.doctype.lms_certificate_request.lms_certificate_request.create_certificate_request",
        args: {
            "course": slot.data("course"),
            "date": $("#slot-date").val(),
            "day": slot.data("day"),
            "start_time": slot.data("start"),
            "end_time": slot.data("end")
        },
        callback: (data) => {
            $("#slot-modal").modal("hide");
            frappe.msgprint(__("Your slot has been booked. Prepare well for the evaluations."));
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        }
    });
};

const display_slots = (e) => {
    frappe.call({
        method: "lms.lms.doctype.course_evaluator.course_evaluator.get_schedule",
        args: {
            "course": $(e.currentTarget).data("course"),
            "date": $(e.currentTarget).val()
        },
        callback: (data) => {
            let options = "";
            data.message.forEach((obj) => {
                options += `<button type="button" class="btn btn-sm btn-secondary mr-3 slot hide"
                    data-course="${$(e.currentTarget).data("course")}"
                    data-day="${obj.day}" data-start="${obj.start_time}" data-end="${obj.end_time}">
                    ${format_time(obj.start_time)} - ${format_time(obj.end_time)}</button>`;
            });
            e.preventDefault();
            $("#slot-modal .slots").html(options);
            const weekday = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
            const day = weekday[new Date($(e.currentTarget).val()).getDay()]

            $(".slot").addClass("hide");
            $(".slot-label").addClass("hide");

            if ($(`[data-day='${day}']`).length) {
                $(".slot-label").removeClass("hide");
                $(`[data-day='${day}']`).removeClass("hide");
                $("#no-slots-message").addClass("hide");
            } else {
                $("#no-slots-message").removeClass("hide");
            }
        }
    });
};

const select_slot = (e) => {
    $(".slot").removeClass("btn-outline-primary");
    $(e.currentTarget).addClass("btn-outline-primary");
    window.selected_slot = $(e.currentTarget);
};

const format_time = (time) => {
    let date = moment(new Date()).format("ddd MMM DD YYYY");
    return moment(`${date} ${time}`).format("HH:mm a");
};

const close_slot_modal = (e) => {
    $("#slot-date").val("");
    $(".slot-label").addClass("hide");
}
