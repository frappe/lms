frappe.ready(function() {
	frappe.web_form.after_save = () => {
    setTimeout(() => {
      window.location.href = `/courses/${frappe.web_form.doc.name}`;
    })
  }
});
