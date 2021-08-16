frappe.ready(() => {
  $("#new-topic").click((e) => {
    show_new_topic_modal(e);
  })
})

var show_new_topic_modal = (e) => {
  e.preventDefault();
  if (frappe.session.user == "Guest") {
    window.location.href = `/login?redirect-to=/discussions/`;
    return;
  }
  $("#discussion-modal").modal("show");
}
