frappe.ready(function() {
	frappe.web_form.after_save = () => {
      frappe.call({
        method: "lms.lms.doctype.course_lesson.course_lesson.get_lesson_info",
        args: {
          "chapter": frappe.web_form.doc.chapter
        },
        callback: (data) => {
            frappe.msgprint(__(`Lesson has been saved successfully. Go back to the chapter and add this lesson to the lessons table.`));
            setTimeout(() => {
                window.location.href = `/courses/${data.message}`;
            }, 3000);
        }
    });
  };
});
