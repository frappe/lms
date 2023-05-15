frappe.ready(() => {
	setup_file_size();
	pin_header();

	$(".join-batch").click((e) => {
		join_course(e);
	});

	$(".notify-me").click((e) => {
		notify_user(e);
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

	$("#create-class").click((e) => {
		open_class_dialog(e);
	});
});

const pin_header = () => {
	const el = document.querySelector(".sticky");
	if (el) {
		const observer = new IntersectionObserver(
			([e]) =>
				e.target.classList.toggle("is-pinned", e.intersectionRatio < 1),
			{ threshold: [1] }
		);
		observer.observe(el);
	}
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

const open_class_dialog = (e) => {
	this.class_dialog = new frappe.ui.Dialog({
		title: __("New Class"),
		fields: [
			{
				fieldtype: "Data",
				label: __("Title"),
				fieldname: "title",
				reqd: 1,
				default: class_info && class_info.title,
			},
			{
				fieldtype: "Date",
				label: __("Start Date"),
				fieldname: "start_date",
				reqd: 1,
				default: class_info && class_info.start_date,
			},
			{
				fieldtype: "Date",
				label: __("End Date"),
				fieldname: "end_date",
				reqd: 1,
				default: class_info && class_info.end_date,
			},
			{
				fieldtype: "Column Break",
			},
			{
				fieldtype: "Int",
				label: __("Seat Count"),
				fieldname: "seat_count",
				default: class_info && class_info.seat_count,
			},
			{
				fieldtype: "Time",
				label: __("Start Time"),
				fieldname: "start_time",
				default: class_info && class_info.start_time,
			},
			{
				fieldtype: "Time",
				label: __("End Time"),
				fieldname: "end_time",
				default: class_info && class_info.end_time,
			},
			{
				fieldtype: "Section Break",
			},
			{
				fieldtype: "Small Text",
				label: __("Description"),
				fieldname: "description",
				default: class_info && class_info.description,
			},
		],
		primary_action_label: __("Save"),
		primary_action: (values) => {
			create_class(values);
		},
	});
	this.class_dialog.show();
};

const create_class = (values) => {
	frappe.call({
		method: "lms.lms.doctype.lms_class.lms_class.create_class",
		args: {
			title: values.title,
			start_date: values.start_date,
			end_date: values.end_date,
			description: values.description,
			seat_count: values.seat_count,
			start_time: values.start_time,
			end_time: values.end_time,
			name: class_info && class_info.name,
		},
		callback: (r) => {
			if (r.message) {
				frappe.show_alert({
					message: class_info
						? __("Class Updated")
						: __("Class Created"),
					indicator: "green",
				});
				this.class_dialog.hide();
				window.location.href = `/classes/${r.message.name}`;
			}
		},
	});
};
