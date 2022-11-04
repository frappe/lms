frappe.ready(function () {
	frappe.web_form.after_load = () => {
		redirect_to_user_profile_form();
		add_listener_for_current_company();
		add_listener_for_certificate_expiry();
		add_listener_for_skill_add_rows();
		add_listener_for_functions_add_rows();
		add_listener_for_industries_add_rows();
	};

	frappe.web_form.validate = () => {
		let information_missing;
		const data = frappe.web_form.get_values();
		if (data && data.work_experience && data.work_experience.length) {
			data.work_experience.forEach((exp) => {
				if (!exp.current && !exp.to_date) {
					information_missing = true;
					frappe.msgprint(
						__("To Date is mandatory in Work Experience.")
					);
				}
			});
		}

		if (information_missing) return false;
		return true;
	};

	frappe.web_form.after_save = () => {
		setTimeout(() => {
			window.location.href = `/profile_/${frappe.web_form.get_value([
				"username",
			])}`;
		});
	};
});

const redirect_to_user_profile_form = () => {
	if (!frappe.utils.get_url_arg("name")) {
		window.location.href = `/edit-profile?name=${frappe.session.user}`;
	}
};

const add_listener_for_current_company = () => {
	$(document).on("click", "input[data-fieldname='current']", (e) => {
		if ($(e.currentTarget).prop("checked"))
			$("div[data-fieldname='to_date']").addClass("hide");
		else $("div[data-fieldname='to_date']").removeClass("hide");
	});
};

const add_listener_for_certificate_expiry = () => {
	$(document).on("click", "input[data-fieldname='expire']", (e) => {
		if ($(e.currentTarget).prop("checked"))
			$("div[data-fieldname='expiration_date']").addClass("hide");
		else $("div[data-fieldname='expiration_date']").removeClass("hide");
	});
};

const add_listener_for_skill_add_rows = () => {
	$('[data-fieldname="skill"]')
		.find(".grid-add-row")
		.click((e) => {
			if ($('[data-fieldname="skill"]').find(".grid-row").length > 5) {
				$('[data-fieldname="skill"]').find(".grid-add-row").hide();
			}
		});
};

const add_listener_for_functions_add_rows = () => {
	$('[data-fieldname="preferred_functions"]')
		.find(".grid-add-row")
		.click((e) => {
			if (
				$('[data-fieldname="preferred_functions"]').find(".grid-row")
					.length > 3
			) {
				$('[data-fieldname="preferred_functions"]')
					.find(".grid-add-row")
					.hide();
			}
		});
};

const add_listener_for_industries_add_rows = () => {
	$('[data-fieldname="preferred_industries"]')
		.find(".grid-add-row")
		.click((e) => {
			if (
				$('[data-fieldname="preferred_industries"]').find(".grid-row")
					.length > 3
			) {
				$('[data-fieldname="preferred_industries"]')
					.find(".grid-add-row")
					.hide();
			}
		});
};
