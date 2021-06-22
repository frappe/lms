frappe.ready(() => {
  if ($(".title").attr("data-membership") && !$(".title").hasClass("is_mentor")) {
    frappe.call({
      method: "community.lms.doctype.lesson.lesson.save_progress",
      args: {
        lesson: $(".title").attr("data-lesson"),
        course: $(".title").attr("data-course")
      }
    })
  }
  if ($(".title").attr("data-membership")) {
    frappe.call("community.lms.api.save_current_lesson", {
      course_name: $(".title").attr("data-course"),
      lesson_name: $(".title").attr("data-lesson")
    })
  }
})
