frappe.ready(() => {
	$(".clickable-row").click((e) => {
		window.location.href = $(e.currentTarget).data("href");
	});
});
