frappe.ready(() => {
  if (!$(".title").hasClass("is_mentor")) {
    frappe.call({
      method: "community.lms.doctype.lesson.lesson.save_progress",
      args: {
        lesson: $(".title").attr("data-name"),
        batch: $(".title").attr("data-batch")
      }
    })
  }
})
