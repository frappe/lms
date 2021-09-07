frappe.ready(function () {

  frappe.web_form.after_load = () => {
    if (!frappe.utils.get_url_arg("name")) {
      window.location.href = `/edit-profile?name=${frappe.session.user}`;
    }
  }

  frappe.web_form.after_save = () => {
    setTimeout(() => {
      window.location.href = `/profile_/${frappe.web_form.get_value(["username"])}`;
    })
  }
})
