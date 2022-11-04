frappe.ready(() => {
	$("#export-as-pdf").click((e) => {
		export_as_png(e);
	});
});

const export_as_pdf = (e) => {
	var formData = new FormData();

	//Push the HTML content into an element
	formData.append("html", $("#certificate-card").html());

	var blob = new Blob([], { type: "text/xml" });
	formData.append("blob", blob);

	var xhr = new XMLHttpRequest();
	xhr.open(
		"POST",
		"/api/method/lms.lms.doctype.lms_certificate.lms_certificate.get_certificate_pdf"
	);
	xhr.setRequestHeader("X-Frappe-CSRF-Token", frappe.csrf_token);
	xhr.responseType = "arraybuffer";

	xhr.onload = function (success) {
		if (this.status === 200) {
			var blob = new Blob([success.currentTarget.response], {
				type: "application/pdf",
			});
			var objectUrl = URL.createObjectURL(blob);

			//Open report in a new window
			window.open(objectUrl);
		}
	};
	xhr.send(formData);
};

const export_as_png = (e) => {
	let button = $(e.currentTarget);
	button.text(__("Exporting..."));

	html2canvas(document.querySelector("#certificate-card"), {
		scrollY: -window.scrollY,
		scrollX: 0,
	})
		.then(function (canvas) {
			let dataURL = canvas.toDataURL("image/png");
			let a = document.createElement("a");
			a.href = dataURL;
			a.download = button.attr("data-certificate-name");
			a.click();
		})
		.finally(() => {
			button.text(__("Export"));
		});
};
