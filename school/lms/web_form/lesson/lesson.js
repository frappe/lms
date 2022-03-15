frappe.ready(function() {
	frappe.web_form.after_save = () => {
    setTimeout(() => {
      frappe.call({
        method: "school.lms.doctype.course_lesson.course_lesson.get_lesson_info",
        args: {
          "chapter": frappe.web_form.doc.chapter
        },
        callback: (data) => {
          window.location.href = `/courses/${data.message}`;
        }
      });
    });
  };
});
