frappe.ready(() => {
	$("#search-course").keyup((e) => {
		search_course(e);
	});

	$(".close-search-empty-state").click((e) => {
		close_search_empty_state(e);
	});

	$("#open-search").click((e) => {
		show_search_bar();
	});

	$("#search-course").focusout((e) => {
		hide_search_bar();
	});
});

const search_course = (e) => {
	let input = $(e.currentTarget).val();

	if (input == window.input) return;

	window.input = input;

	if (input.length < 3 || input.trim() == "") {
		$(".course-card").removeClass("hide");
		$(".search-empty-state").addClass("hide");
		fix_heading_styles();
		return;
	}

	frappe.call({
		method: "lms.lms.doctype.lms_course.lms_course.search_course",
		args: {
			text: input,
		},
		callback: (data) => {
			let courses = data.message;
			$(".result-row").remove();
			for (let i in courses) {
				let element = `<div class="result-row">
					${courses[i].title}
				</div>`;
				$("#search-result").append(element);
			}
		},
	});
};

const render_course_list = (courses) => {
	fix_heading_styles();
	$(".search-empty-state").addClass("hide");

	if (!courses.length) {
		$(".course-card").removeClass("hide");
		$(".search-empty-state").removeClass("hide");
		return;
	}

	$(".course-card").addClass("hide");
	for (course in courses) {
		$("[data-course=" + courses[course].name + "]").removeClass("hide");
	}

	const visible_live_courses = $(".live-courses .course-card").not(".hide");
	const visible_upcoming_courses = $(".upcoming-courses .course-card").not(
		".hide"
	);

	if (!visible_live_courses.length) {
		$(".live-courses .course-home-headings").addClass("hide");
		$(".upcoming-courses").removeClass("mt-10");
	}

	if (!visible_upcoming_courses.length) {
		$(".upcoming-courses .course-home-headings").addClass("hide");
	}
};

const fix_heading_styles = () => {
	$(".course-home-headings").removeClass("hide");
	$(".upcoming-courses").addClass("mt-10");
};

const close_search_empty_state = (e) => {
	$(".search-empty-state").addClass("hide");
	$("#search-course").val("");
};

const show_search_bar = () => {
	$("#open-search").addClass("hide");
	$("#search-modal").css("display", "block");
	$("#search-course").focus();
};

const hide_search_bar = () => {
	$("#open-search").removeClass("hide");
	$("#search-modal").css("display", "none");
};
