frappe.ready(() => {
	$("#certificate-filter").change((e) => {
		filter_certified_participants();
	});
});

const filter_certified_participants = () => {
	const certificate = $("#certificate-filter").val();
	$(".common-card-style").removeClass("hide");

	if (certificate) {
		$(".common-card-style").addClass("hide");
		$(`[data-course='${certificate}']`)
			.closest(".common-card-style")
			.removeClass("hide");
		console.log(certificate);
	}
};
