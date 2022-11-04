frappe.ready(() => {
	hide_profile_and_dashboard_for_guest_users();
});

const hide_profile_and_dashboard_for_guest_users = () => {
	if (frappe.session.user == "Guest") {
		let links = $(".nav-link").filter(
			(i, elem) =>
				$(elem).text().trim() === "My Profile" ||
				$(elem).text().trim() === "Dashboard"
		);
		links.length && links.each((i, elem) => $(elem).addClass("hide"));
	}
};
