frappe.ready(() => {
	$("#load-more").click((e) => {
		search(e);
	});

	$(".close-search-empty-state").click((e) => {
		close_search_empty_state(e);
	});

	$("#search-user").keyup(function () {
		let timer;
		clearTimeout(timer);
		timer = setTimeout(() => {
			search.apply(this, arguments);
		}, 300);
	});
});

const search = (e) => {
	$("#search-empty-state").addClass("hide");
	let start = $(e.currentTarget).data("start");
	let input = $("#search-user").val();
	if ($(e.currentTarget).prop("nodeName") == "INPUT") start = 0;

	frappe.call({
		method: "lms.overrides.user.search_users",
		args: {
			start: start,
			text: input,
		},
		callback: (data) => {
			if ($(e.currentTarget).prop("nodeName") == "INPUT")
				$(".member-parent").empty();

			if (data.message.user_details.length)
				$("#load-more").removeClass("hide");
			else $("#search-empty-state").removeClass("hide");

			let user_details = data.message.user_details;
			user_details
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/"/g, "&quot;");
			$(".member-parent").append(user_details);
			update_load_more_state(data);
		},
	});
};

const close_search_empty_state = (e) => {
	$("#search-empty-state").addClass("hide");
	$("#search-user").val("").keyup();
};

const update_load_more_state = (data) => {
	$("#load-more").data("start", data.message.start);
	$("#load-more").data("count", data.message.count);
	if ($(".member-card").length == $("#load-more").data("count")) {
		$("#load-more").addClass("hide");
	}
};
