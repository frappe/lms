frappe.ready(() => {

  if ($(document).width() <= 550) {
    $(".certificate-footer").css("flex-direction", "column");
    $(".certificate-footer").children().addClass("mb-5");
  }

  $("#export-as-pdf").click((e) => {
    export_as_pdf(e);
  })
})

var export_as_pdf = (e) => {
  var button = $(e.currentTarget);
  button.text(__("Exporting..."));

  html2canvas(document.querySelector('.common-card-style'), {
    scrollY: -window.scrollY,
    scrollX: 0
  }).then(function(canvas) {
    let dataURL = canvas.toDataURL('image/png');
    let a = document.createElement('a');
    a.href = dataURL;
    a.download = button.attr("data-certificate-name");
    a.click();
  }).finally(() => {
    button.text(__("Export as PDF"))
  });
}
