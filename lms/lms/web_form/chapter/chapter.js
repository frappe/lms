frappe.ready(function() {
    frappe.web_form.after_save = () => {
        frappe.show_alert({
            message:__("Chapter has been saved successfully. Go back to the course and add this chapter to the chapters table."),
            indicator:'green'
        }, 3);
        setTimeout(() => {
            window.location.href = `/courses/${frappe.web_form.doc.course}`;
        }, 3000);
    }
});
