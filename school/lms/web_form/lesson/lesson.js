frappe.ready(function() {
	frappe.web_form.after_save = () => {
    setTimeout(() => {

      frappe.call({
        method: "school.lms.doctype.course_lesson.course_lesson.get_lesson_info",
        args: {
          "lesson_name": frappe.web_form.doc.name
        },
        callback: (data) => {
          window.location.href = data.message;
        }
      });

    });
  };
});
