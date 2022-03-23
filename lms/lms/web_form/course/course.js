frappe.ready(function() {
    frappe.web_form.after_save = () => {
        let route = frappe.web_form.doc.name ? `/courses/${frappe.web_form.doc.name}` : `/course`;
        window.location.href = route;
    }
});
