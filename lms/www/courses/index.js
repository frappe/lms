frappe.ready(() => {

	$(".nav-link").click((e) => {
		change_hash(e);
	});

	if (window.location.hash) {
		open_tab();
	}

});


const change_hash = (e) => {
	window.location.hash = $(e.currentTarget).attr("href");
};

const open_tab = () => {
	$(`a[href="${window.location.hash}"]`).click();
};
