frappe.ready(() => {
  $("#report").click((e) => {
    open_report_dialog(e);
  });

  $("#submit-report").click((e) => {
    report(e);
  });
});

const open_report_dialog = (e) => {
  e.preventDefault();
  $("#report-modal").modal("show");
};

const report = (e) => {
  frappe.call({
    method: "school.job.doctype.job_opportunity.job_opportunity.report",
    args: {
      "job": $(e.currentTarget).data("job"),
      "reason": $(".report-field").val()
    },
    callback: (data) => {
      $(".report-modal").modal("hide");
      frappe.msgprint(__("Thanks for informing us about this post. The Admins will look into this and take an appropriate action soon."))
    }
  })
}
