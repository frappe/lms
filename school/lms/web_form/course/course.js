frappe.ready(function() {
    frappe.web_form.after_save = () => {
        window.location.href = `/dashboard#courses-created`;
    }
});
