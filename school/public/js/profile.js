frappe.ready(() => {
  hide_profile_for_guest_users();
  restrict_users_to_profile_page();
});

const hide_profile_for_guest_users = () => {
  if (frappe.session.user == "Guest") {
    var link_array = $('.nav-link').filter((i, elem) => $(elem).text().trim() === "My Profile");
    link_array.length && $(link_array[0]).addClass("hide");
  }
};

const restrict_users_to_profile_page = () => {
  if (frappe.session.user != "Guest") {
    frappe.call({
      "method": "school.lms.doctype.lms_settings.lms_settings.check_profile_restriction",
      "callback": (data) => {
        if (data.message && data.message.redirect) {
          window.location.href = `${data.message.prefix}${data.message.username}`;
        }
      }
    });
  }
};
