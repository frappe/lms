frappe.ready(function () {

  frappe.web_form.after_load = () => {

    if (!frappe.utils.get_url_arg("name")) {
      window.location.href = `/edit-profile?name=${frappe.session.user}`;
    }

    $(document).on("click", "input[data-fieldname='current']", (e) => {
      if ($(e.currentTarget).prop("checked"))
        $("div[data-fieldname='to_date']").addClass("hide");
      else
        $("div[data-fieldname='to_date']").removeClass("hide");
    });

  }

  frappe.web_form.validate = () => {
    let to_date_missing;
    const data = frappe.web_form.get_values();
    data.work_experience.forEach(exp => {
      if (!exp.current && !exp.to_date) {
        to_date_missing = true
        frappe.msgprint('To Date is mandatory in Work Experience.');
      }
    });
    if (to_date_missing)
      return false;
    return true;
  };



  frappe.web_form.after_save = () => {
    setTimeout(() => {
      window.location.href = `/profile_/${frappe.web_form.get_value(["username"])}`;
    })
  }
})
