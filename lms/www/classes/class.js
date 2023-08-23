frappe.ready(() => {
	let self = this;

	$(".btn-add-student").click((e) => {
		show_student_modal(e);
	});

	$(".btn-remove-student").click((e) => {
		remove_student(e);
	});

	if ($("#live-class-form").length) {
		make_live_class_form();
	}

	$("#open-class-modal").click((e) => {
		e.preventDefault();
		$("#live-class-modal").modal("show");
	});

	$("#create-live-class").click((e) => {
		create_live_class(e);
	});

	$(".btn-add-course").click((e) => {
		show_course_modal(e);
	});

	$(".btn-remove-course").click((e) => {
		remove_course(e);
	});

	$(".btn-remove-assessment").click((e) => {
		remove_assessment(e);
	});

	$("#open-assessment-modal").click((e) => {
		e.preventDefault();
		show_assessment_modal();
	});

	$(".btn-close").click((e) => {
		window.location.reload();
	});

	$(".btn-schedule-eval").click((e) => {
		open_evaluation_form(e);
	});

	$(document).on("click", ".slot", (e) => {
		mark_active_slot(e);
	});
});

const create_live_class = (e) => {
	let class_name = $(".class-details").data("class");
	frappe.call({
		method: "lms.lms.doctype.lms_class.lms_class.create_live_class",
		args: {
			class_name: class_name,
			title: $("input[data-fieldname='meeting_title']").val(),
			duration: $("input[data-fieldname='meeting_duration']").val(),
			date: $("input[data-fieldname='meeting_date']").val(),
			time: $("input[data-fieldname='meeting_time']").val(),
			timezone: $('select[data-fieldname="meeting_timezone"]').val(),
			auto_recording: $(
				'select[data-fieldname="meeting_recording"]'
			).val(),
			description: $(
				"textarea[data-fieldname='meeting_description']"
			).val(),
		},
		callback: (data) => {
			$("#live-class-modal").modal("hide");
			frappe.show_alert(
				{
					message: __("Live Class added successfully"),
					indicator: "green",
				},
				3
			);
			setTimeout(function () {
				window.location.reload();
			}, 1000);
		},
	});
};

const make_live_class_form = (e) => {
	this.field_group = new frappe.ui.FieldGroup({
		fields: [
			{
				fieldname: "meeting_title",
				fieldtype: "Data",
				options: "",
				label: "Title",
				reqd: 1,
			},
			{
				fieldname: "meeting_time",
				fieldtype: "Time",
				options: "",
				label: "Time",
				reqd: 1,
			},
			{
				fieldname: "meeting_timezone",
				label: __("Time Zone"),
				fieldtype: "Select",
				options: get_timezones().join("\n"),
				reqd: 1,
			},
			{
				fieldname: "meeting_col",
				fieldtype: "Column Break",
				options: "",
			},
			{
				fieldname: "meeting_date",
				fieldtype: "Date",
				options: "",
				label: "Date",
				reqd: 1,
			},
			{
				fieldname: "meeting_duration",
				fieldtype: "Int",
				options: "",
				label: "Duration (in Minutes)",
				reqd: 1,
			},
			{
				fieldname: "meeting_recording",
				fieldtype: "Select",
				options: "No Recording\nLocal\nCloud",
				label: "Auto Recording",
				default: "No Recording",
			},
			{
				fieldname: "meeting_sec",
				fieldtype: "Section Break",
				options: "",
			},
			{
				fieldname: "meeting_description",
				fieldtype: "Small Text",
				options: "",
				max_height: 100,
				min_lines: 5,
				label: "Description",
			},
		],
		body: $("#live-class-form").get(0),
	});

	this.field_group.make();
	$("#live-class-form .form-section:last").removeClass("empty-section");
	$("#live-class-form .frappe-control").removeClass("hide-control");
};

const get_timezones = () => {
	return [
		"Pacific/Midway",
		"Pacific/Pago_Pago",
		"Pacific/Honolulu",
		"America/Anchorage",
		"America/Vancouver",
		"America/Los_Angeles",
		"America/Tijuana",
		"America/Edmonton",
		"America/Denver",
		"America/Phoenix",
		"America/Mazatlan",
		"America/Winnipeg",
		"America/Regina",
		"America/Chicago",
		"America/Mexico_City",
		"America/Guatemala",
		"America/El_Salvador",
		"America/Managua",
		"America/Costa_Rica",
		"America/Montreal",
		"America/New_York",
		"America/Indianapolis",
		"America/Panama",
		"America/Bogota",
		"America/Lima",
		"America/Halifax",
		"America/Puerto_Rico",
		"America/Caracas",
		"America/Santiago",
		"America/St_Johns",
		"America/Montevideo",
		"America/Araguaina",
		"America/Argentina/Buenos_Aires",
		"America/Godthab",
		"America/Sao_Paulo",
		"Atlantic/Azores",
		"Canada/Atlantic",
		"Atlantic/Cape_Verde",
		"UTC",
		"Etc/Greenwich",
		"Europe/Belgrade",
		"CET",
		"Atlantic/Reykjavik",
		"Europe/Dublin",
		"Europe/London",
		"Europe/Lisbon",
		"Africa/Casablanca",
		"Africa/Nouakchott",
		"Europe/Oslo",
		"Europe/Copenhagen",
		"Europe/Brussels",
		"Europe/Berlin",
		"Europe/Helsinki",
		"Europe/Amsterdam",
		"Europe/Rome",
		"Europe/Stockholm",
		"Europe/Vienna",
		"Europe/Luxembourg",
		"Europe/Paris",
		"Europe/Zurich",
		"Europe/Madrid",
		"Africa/Bangui",
		"Africa/Algiers",
		"Africa/Tunis",
		"Africa/Harare",
		"Africa/Nairobi",
		"Europe/Warsaw",
		"Europe/Prague",
		"Europe/Budapest",
		"Europe/Sofia",
		"Europe/Istanbul",
		"Europe/Athens",
		"Europe/Bucharest",
		"Asia/Nicosia",
		"Asia/Beirut",
		"Asia/Damascus",
		"Asia/Jerusalem",
		"Asia/Amman",
		"Africa/Tripoli",
		"Africa/Cairo",
		"Africa/Johannesburg",
		"Europe/Moscow",
		"Asia/Baghdad",
		"Asia/Kuwait",
		"Asia/Riyadh",
		"Asia/Bahrain",
		"Asia/Qatar",
		"Asia/Aden",
		"Asia/Tehran",
		"Africa/Khartoum",
		"Africa/Djibouti",
		"Africa/Mogadishu",
		"Asia/Dubai",
		"Asia/Muscat",
		"Asia/Baku",
		"Asia/Kabul",
		"Asia/Yekaterinburg",
		"Asia/Tashkent",
		"Asia/Calcutta",
		"Asia/Kathmandu",
		"Asia/Novosibirsk",
		"Asia/Almaty",
		"Asia/Dacca",
		"Asia/Krasnoyarsk",
		"Asia/Dhaka",
		"Asia/Bangkok",
		"Asia/Saigon",
		"Asia/Jakarta",
		"Asia/Irkutsk",
		"Asia/Shanghai",
		"Asia/Hong_Kong",
		"Asia/Taipei",
		"Asia/Kuala_Lumpur",
		"Asia/Singapore",
		"Australia/Perth",
		"Asia/Yakutsk",
		"Asia/Seoul",
		"Asia/Tokyo",
		"Australia/Darwin",
		"Australia/Adelaide",
		"Asia/Vladivostok",
		"Pacific/Port_Moresby",
		"Australia/Brisbane",
		"Australia/Sydney",
		"Australia/Hobart",
		"Asia/Magadan",
		"SST",
		"Pacific/Noumea",
		"Asia/Kamchatka",
		"Pacific/Fiji",
		"Pacific/Auckland",
		"Asia/Kolkata",
		"Europe/Kiev",
		"America/Tegucigalpa",
		"Pacific/Apia",
	];
};

const show_course_modal = () => {
	let course_modal = new frappe.ui.Dialog({
		title: "Add Course",
		fields: [
			{
				fieldtype: "Link",
				options: "LMS Course",
				label: __("Course"),
				fieldname: "course",
				reqd: 1,
			},
		],
		primary_action_label: __("Add"),
		primary_action(values) {
			add_course(values);
			course_modal.hide();
		},
	});
	course_modal.show();
	setTimeout(() => {
		$(".modal-body").css("min-height", "200px");
	}, 1000);
};

const add_course = (values) => {
	frappe.call({
		method: "frappe.client.insert",
		args: {
			doc: {
				doctype: "Class Course",
				course: values.course,
				parenttype: "LMS Class",
				parentfield: "courses",
				parent: $(".class-details").data("class"),
			},
		},
		callback(r) {
			frappe.show_alert(
				{
					message: __("Course Added"),
					indicator: "green",
				},
				2000
			);
			window.location.reload();
		},
	});
};

const remove_course = (e) => {
	frappe.confirm("Are you sure you want to remove this course?", () => {
		frappe.call({
			method: "lms.lms.doctype.lms_class.lms_class.remove_course",
			args: {
				course: $(e.currentTarget).data("course"),
				parent: $(".class-details").data("class"),
			},
			callback(r) {
				frappe.show_alert(
					{
						message: __("Course Removed"),
						indicator: "green",
					},
					2000
				);
				window.location.reload();
			},
		});
	});
};

const show_student_modal = () => {
	let student_modal = new frappe.ui.Dialog({
		title: "Add Student",
		fields: [
			{
				fieldtype: "Link",
				options: "User",
				label: __("Student"),
				fieldname: "student",
				reqd: 1,
				filters: {
					ignore_user_type: 1,
				},
				filter_description: " ",
			},
		],
		primary_action_label: __("Add"),
		primary_action(values) {
			add_student(values);
			student_modal.hide();
		},
	});
	student_modal.show();
	setTimeout(() => {
		$(".modal-body").css("min-height", "200px");
	}, 1000);
};

const add_student = (values) => {
	frappe.call({
		method: "frappe.client.insert",
		args: {
			doc: {
				doctype: "Class Student",
				student: values.student,
				parenttype: "LMS Class",
				parentfield: "students",
				parent: $(".class-details").data("class"),
			},
		},
		callback(r) {
			frappe.show_alert(
				{
					message: __("Student Added"),
					indicator: "green",
				},
				2000
			);
			window.location.reload();
		},
	});
};

const remove_student = (e) => {
	frappe.confirm(
		"Are you sure you want to remove this student from the class?",
		() => {
			frappe.call({
				method: "lms.lms.doctype.lms_class.lms_class.remove_student",
				args: {
					student: $(e.currentTarget).data("student"),
					class_name: $(".class-details").data("class"),
				},
				callback: (data) => {
					frappe.show_alert(
						{
							message: __("Student removed successfully"),
							indicator: "green",
						},
						2000
					);
					window.location.reload();
				},
			});
		}
	);
};

const show_assessment_modal = (e) => {
	let assessment_modal = new frappe.ui.Dialog({
		title: "Manage Assessments",
		fields: [
			{
				fieldtype: "Link",
				options: "DocType",
				label: __("Assessment Type"),
				fieldname: "assessment_type",
				reqd: 1,
				filters: {
					name: ["in", ["LMS Assignment", "LMS Quiz"]],
				},
				filter_description: " ",
			},
			{
				fieldtype: "Dynamic Link",
				options: "assessment_type",
				label: __("Assessment"),
				fieldname: "assessment_name",
				reqd: 1,
			},
			{
				fieldtype: "Section Break",
				label: __("OR"),
			},
			{
				fieldtype: "Button",
				label: __("Create Assignment"),
				fieldname: "create_assignment",
				click: () => {
					window.location.href = "/assignments";
				},
			},
			{
				fieldtype: "Column Break",
			},
			{
				fieldtype: "Button",
				label: __("Create Quiz"),
				fieldname: "create_quiz",
				click: () => {
					window.location.href = "/quizzes";
				},
			},
		],
		primary_action_label: __("Add"),
		primary_action(values) {
			add_addessment(values);
			assessment_modal.hide();
		},
	});
	assessment_modal.show();
	setTimeout(() => {
		$(".modal-body").css("min-height", "300px");
	}, 1000);
};

const add_addessment = (values) => {
	frappe.call({
		method: "frappe.client.insert",
		args: {
			doc: {
				doctype: "LMS Assessment",
				assessment_type: values.assessment_type,
				assessment_name: values.assessment_name,
				parenttype: "LMS Class",
				parentfield: "assessment",
				parent: $(".class-details").data("class"),
			},
		},
		callback(r) {
			frappe.show_alert(
				{
					message: __("Assessment Added"),
					indicator: "green",
				},
				2000
			);
			window.location.reload();
		},
	});
};

const remove_assessment = (e) => {
	frappe.confirm("Are you sure you want to remove this assessment?", () => {
		frappe.call({
			method: "lms.lms.doctype.lms_class.lms_class.remove_assessment",
			args: {
				assessment: $(e.currentTarget).data("assessment"),
				parent: $(".class-details").data("class"),
			},
			callback(r) {
				frappe.show_alert(
					{
						message: __("Assessment Removed"),
						indicator: "green",
					},
					2000
				);
				window.location.reload();
			},
		});
	});
};

const open_evaluation_form = (e) => {
	this.eval_form = new frappe.ui.Dialog({
		title: __("Schedule Evaluation"),
		fields: [
			{
				fieldtype: "Link",
				fieldname: "course",
				label: __("Course"),
				options: "LMS Course",
				reqd: 1,
				filters: {
					name: ["in", courses],
				},
				filter_description: " ",
			},
			{
				fieldtype: "Date",
				fieldname: "date",
				label: __("Date"),
				reqd: 1,
				min_date: new Date(
					frappe.datetime.add_days(frappe.datetime.get_today(), 1)
				),
				change: () => {
					get_slots();
				},
			},
			{
				fieldtype: "HTML",
				fieldname: "slots",
				label: __("Slots"),
			},
		],
		primary_action: (values) => {
			submit_evaluation_form(values);
		},
	});
	this.eval_form.show();
	setTimeout(() => {
		$(".modal-body").css("min-height", "300px");
	}, 1000);
};

const get_slots = () => {
	frappe.call({
		method: "lms.lms.doctype.course_evaluator.course_evaluator.get_schedule",
		args: {
			course: this.eval_form.get_value("course"),
			date: this.eval_form.get_value("date"),
			class_name: $(".class-details").data("class"),
		},
		callback: (r) => {
			if (r.message) {
				display_slots(r.message);
			}
		},
	});
};

const display_slots = (slots) => {
	let slot_html = "";
	let slots_available = false;
	if (slots.length) {
		slot_html = `<div>
			<div class="mb-2"> ${__("Select a Slot")} </div>
			<div class="slots-parent">`;
		let day = moment(this.eval_form.get_value("date")).format("dddd");

		slots.forEach((slot) => {
			if (slot.day == day) {
				slots_available = true;
				slot_html += `<div class="btn btn-sm btn-default slot" data-day="${
					slot.day
				}"
					data-start="${slot.start_time}" data-end="${slot.end_time}">
					${moment(slot.start_time, "hh:mm").format("hh:mm a")} -
					${moment(slot.end_time, "hh:mm").format("hh:mm a")}
				</div>`;
			}
		});
		slot_html += "</div> </div>";
	}

	if (!slots_available) {
		slot_html = `<div class="alert alert-danger" role="alert">
			No slots available for this date.
		</div>`;
	}

	$("[data-fieldname='slots']").html(slot_html);
};

const mark_active_slot = (e) => {
	$(".slot").removeClass("btn-outline-primary");
	$(e.currentTarget).addClass("btn-outline-primary");
	this.current_slot = $(e.currentTarget);
};

const submit_evaluation_form = (values) => {
	if (!this.current_slot) {
		frappe.throw(__("Please select a slot"));
	}

	frappe.call({
		method: "lms.lms.doctype.lms_certificate_request.lms_certificate_request.create_certificate_request",
		args: {
			course: values.course,
			date: values.date,
			start_time: this.current_slot.data("start"),
			end_time: this.current_slot.data("end"),
			day: this.current_slot.data("day"),
			class_name: $(".class-details").data("class"),
		},
		callback: (r) => {
			this.eval_form.hide();
			frappe.show_alert({
				message: __("Evaluation scheduled successfully"),
				indicator: "green",
			});
			setTimeout(() => {
				window.location.reload();
			}, 1000);
		},
	});
};
