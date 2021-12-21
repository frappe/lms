frappe.ready(() => {
  hide_profile_for_guest_users();
});

const hide_profile_for_guest_users = () => {
  if (frappe.session.user == "Guest") {
    var link_array = $('.nav-link').filter((i, elem) => $(elem).text().trim() === "My Profile");
    link_array.length && $(link_array[0]).addClass("hide");
  }
};
