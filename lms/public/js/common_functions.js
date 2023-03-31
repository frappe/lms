frappe.ready(() => {
	setup_file_size();

	$(".join-batch").click((e) => {
		join_course(e);
	});

	$(".notify-me").click((e) => {
		notify_user(e);
	});

	$(".btn-chapter").click((e) => {
		add_chapter(e);
	});

	$(document).on("click", ".btn-save-chapter", (e) => {
		save_chapter(e);
	});

	$(".nav-link").click((e) => {
		change_hash(e);
	});

	if (window.location.hash) {
		open_tab();
	}

	if (window.location.pathname == "/statistics") {
		generate_graph("New Signups", "#new-signups");
		generate_graph("Course Enrollments", "#course-enrollments");
		generate_graph("Lesson Completion", "#lesson-completion");
		generate_course_completion_graph();
	}

	expand_the_active_chapter();

	$(".chapter-title")
		.unbind()
		.click((e) => {
			rotate_chapter_icon(e);
		});

	$(".no-preview").click((e) => {
		show_no_preview_dialog(e);
	});

	$(".lesson-dropzone").each((i, el) => {
		setSortable(el);
	});

	$(".chapter-dropzone").each((i, el) => {
		setSortable(el);
	});
});

const setSortable = (el) => {
	new Sortable(el, {
		group: {
			name: "les",
			pull: "les",
			put: "les",
		},
		onEnd: (e) => {
			if ($(e.item).hasClass("lesson-info")) reorder_lesson(e);
			else reorder_chapter(e);
		},
		onMove: (e) => {
			if (
				$(e.dragged).hasClass("lesson-info") &&
				$(e.to).hasClass("chapter-dropzone")
			)
				return false;
			if (
				$(e.dragged).hasClass("chapter-edit") &&
				$(e.to).hasClass("lesson-dropzone")
			)
				return false;
		},
	});
};

const setup_file_size = () => {
	frappe.provide("frappe.form.formatters");
	frappe.form.formatters.FileSize = file_size;
};

const file_size = (value) => {
	if (value > 1048576) {
		value = flt(flt(value) / 1048576, 1) + "M";
	} else if (value > 1024) {
		value = flt(flt(value) / 1024, 1) + "K";
	}
	return value;
};

const join_course = (e) => {
	e.preventDefault();
	let course = $("#outline-heading").attr("data-course");
	if (frappe.session.user == "Guest") {
		window.location.href = `/login?redirect-to=/courses/${course}`;
		return;
	}

	let batch = $(e.currentTarget).attr("data-batch");
	batch = batch ? decodeURIComponent(batch) : "";
	frappe.call({
		method: "lms.lms.doctype.lms_batch_membership.lms_batch_membership.create_membership",
		args: {
			batch: batch ? batch : "",
			course: course,
		},
		callback: (data) => {
			if (data.message == "OK") {
				$(".no-preview-modal").modal("hide");
				frappe.show_alert(
					{
						message: __("Enrolled successfully"),
						indicator: "green",
					},
					3
				);
				setTimeout(function () {
					window.location.href = `/courses/${course}/learn/1.1`;
				}, 1000);
			}
		},
	});
};

const notify_user = (e) => {
	e.preventDefault();
	var course = decodeURIComponent($("#outline-heading").attr("data-course"));
	if (frappe.session.user == "Guest") {
		window.location.href = `/login?redirect-to=/courses/${course}`;
		return;
	}

	frappe.call({
		method: "lms.lms.doctype.lms_course_interest.lms_course_interest.capture_interest",
		args: {
			course: course,
		},
		callback: (data) => {
			$(".no-preview-modal").modal("hide");
			frappe.show_alert(
				{
					message: __(
						"You have opted to be notified for this course. You will receive an email when the course becomes available."
					),
					indicator: "green",
				},
				3
			);
			setTimeout(() => {
				window.location.reload();
			}, 3000);
		},
	});
};

const add_chapter = (e) => {
	if ($(".new-chapter").length) {
		scroll_to_chapter_container();
		return;
	}

	let next_index = $("[data-index]").last().data("index") + 1 || 1;
	let add_after = $(`.chapter-parent:last`).length
		? $(`.chapter-dropzone`)
		: $("#outline-heading");

	$(`<div class="chapter-parent chapter-edit new-chapter">
        <div contenteditable="true" data-placeholder="${__(
			"Chapter Name"
		)}" class="chapter-title-main"></div>
        <div class="chapter-description small my-2" contenteditable="true"
            data-placeholder="${__("Short Description")}"></div>
        <button class="btn btn-sm btn-secondary d-block btn-save-chapter"
        data-index="${next_index}"> ${__("Save")} </button>
        </div>`).insertAfter(add_after);

	scroll_to_chapter_container();
};

const scroll_to_chapter_container = () => {
	$([document.documentElement, document.body]).animate(
		{
			scrollTop: $(".new-chapter").offset().top,
		},
		1000
	);
	$(".new-chapter").find(".chapter-title-main").focus();
};

const save_chapter = (e) => {
	let target = $(e.currentTarget);
	let parent = target.closest(".chapter-parent");

	frappe.call({
		method: "lms.lms.doctype.lms_course.lms_course.save_chapter",
		args: {
			course: $("#title").data("course"),
			title: parent.find(".chapter-title-main").text(),
			chapter_description: parent.find(".chapter-description").text(),
			idx: target.data("index"),
			chapter: parent.data("chapter") ? parent.data("chapter") : "",
		},
		callback: (data) => {
			frappe.show_alert({
				message: __("Saved"),
				indicator: "green",
			});
			setTimeout(() => {
				window.location.reload();
			}, 1000);
		},
	});
};

const generate_graph = (chart_name, element, type = "line") => {
	let date = frappe.datetime;

	frappe.call({
		method: "lms.lms.utils.get_chart_data",
		args: {
			chart_name: chart_name,
			timespan: "Select Date Range",
			timegrain: "Daily",
			from_date: date.add_days(date.get_today(), -30),
			to_date: date.add_days(date.get_today(), +1),
		},
		callback: (data) => {
			render_chart(data.message, chart_name, element, type);
		},
	});
};

const render_chart = (data, chart_name, element, type) => {
	const chart = new frappe.Chart(element, {
		title: chart_name,
		data: data,
		type: type,
		height: 250,
		colors: ["#4563f1"],
		axisOptions: {
			xIsSeries: 1,
		},
		lineOptions: {
			regionFill: 1,
		},
	});
};

const generate_course_completion_graph = () => {
	frappe.call({
		method: "lms.lms.utils.get_course_completion_data",
		callback: (data) => {
			render_chart(
				data.message,
				"Course Completion",
				"#course-completion",
				"pie"
			);
		},
	});
};

const change_hash = (e) => {
	window.location.hash = $(e.currentTarget).attr("href");
};

const open_tab = () => {
	$(`a[href="${window.location.hash}"]`).click();
};

const expand_the_first_chapter = () => {
	let elements = $(".course-home-outline .collapse");
	elements.each((i, element) => {
		if (i < 1) {
			show_section(element);
			return false;
		}
	});
};

const expand_the_active_chapter = () => {
	/* Find anchor matching the URL for course details page */
	let selector = $(
		`a[href="${decodeURIComponent(window.location.pathname)}"]`
	).parent();

	if (!selector.length) {
		selector = $(
			`a[href^="${decodeURIComponent(window.location.pathname)}"]`
		).parent();
	}
	if (selector.length && $(".course-details-page").length) {
		expand_for_course_details(selector);
	} else if ($(".active-lesson").length) {
		/* For course home page */
		selector = $(".active-lesson");
		show_section(selector.parent().parent());
	} else {
		/* If no active chapter then exapand the first chapter */
		expand_the_first_chapter();
	}
};

const expand_for_course_details = (selector) => {
	$(".lesson-info").removeClass("active-lesson");
	$(".lesson-info").each((i, elem) => {
		let href = $(elem).find("use").attr("href");
		href.endsWith("blue") &&
			$(elem)
				.find("use")
				.attr("href", href.substring(0, href.length - 5));
	});
	selector.addClass("active-lesson");

	show_section(selector.parent().parent());
};

const show_section = (element) => {
	$(element).addClass("show");
	$(element)
		.siblings(".chapter-title")
		.children(".chapter-icon")
		.css("transform", "rotate(90deg)");
	$(element).siblings(".chapter-title").attr("aria-expanded", true);
};

const rotate_chapter_icon = (e) => {
	let icon = $(e.currentTarget).children(".chapter-icon");
	if (icon.css("transform") == "none") {
		icon.css("transform", "rotate(90deg)");
	} else {
		icon.css("transform", "none");
	}
};

const show_no_preview_dialog = (e) => {
	$("#no-preview-modal").modal("show");
};

const reorder_lesson = (e) => {
	let old_chapter = $(e.from).closest(".chapter-edit").data("chapter");
	let new_chapter = $(e.to).closest(".chapter-edit").data("chapter");

	if (old_chapter == new_chapter && e.oldIndex == e.newIndex) return;

	frappe.call({
		method: "lms.lms.doctype.lms_course.lms_course.reorder_lesson",
		args: {
			old_chapter: old_chapter,
			old_lesson_array: $(e.from)
				.children()
				.map((i, e) => $(e).data("lesson"))
				.get(),
			new_chapter: new_chapter,
			new_lesson_array: $(e.to)
				.children()
				.map((i, e) => $(e).data("lesson"))
				.get(),
		},
		callback: (data) => {
			window.location.reload();
		},
	});
};

const reorder_chapter = (e) => {
	if (e.oldIndex == e.newIndex) return;

	frappe.call({
		method: "lms.lms.doctype.lms_course.lms_course.reorder_chapter",
		args: {
			new_index: e.newIndex + 1,
			chapter_array: $(e.to)
				.children()
				.map((i, e) => $(e).data("chapter"))
				.get(),
		},
		callback: (data) => {
			window.location.reload();
		},
	});
};
