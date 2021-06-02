frappe.ready(() => {
  console.log($(".title").hasClass("is_mentor"))
  if (!$(".title").hasClass("is_mentor")) {
    frappe.call({
      method: "community.lms.doctype.lesson.lesson.save_progress",
      args: {
        lesson: $(".title").attr("data-name")
      }
    })
  }
})
