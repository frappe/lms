frappe.ready(() => {
	make_profile_active_in_navbar();

	$(".role").change((e) => {
		save_role(e);
	});
});

const make_profile_active_in_navbar = () => {
	let member_name = $(".profile-name").data("name");
	if (member_name == frappe.session.user) {
		setTimeout(() => {
			let link_array = $(".nav-link").filter(
				(i, elem) => $(elem).text().trim() === "My Profile"
			);
			link_array.length && $(link_array[0]).addClass("active");
		}, 0);
	}
};

const save_role = (e) => {
	let member_name = $(".profile-name").data("name");
	let role = $(e.currentTarget).children("input");
	frappe.call({
		method: "lms.overrides.user.save_role",
		args: {
			user: member_name,
			role: role.data("role"),
			value: role.prop("checked") ? 1 : 0,
		},
		callback: (data) => {
			if (data.message) {
				frappe.show_alert({
					message: __("Saved"),
					indicator: "green",
				});
			}
		},
	});
};
