frappe.ready(() => {
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
});

const submit_student = (e) => {
	e.preventDefault();
	if ($('input[data-fieldname="student_input"]').val()) {
		frappe.call({
			method: "lms.lms.doctype.lms_class.lms_class.add_student",
			args: {
				email: $('input[data-fieldname="student_input"]').val(),
				class_name: $(".class-details").data("class"),
			},
			callback: (data) => {
				frappe.show_alert(
					{
						message: __("Student added successfully"),
						indicator: "green",
					},
					3
				);
				window.location.reload();
			},
		});
	}
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
						3
					);
					window.location.reload();
				},
			});
		}
	);
};

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
			{
				fieldtype: "HTML",
				fieldname: "instructions",
				label: __("Instructions"),
				options: __("Select a course to add to this class."),
			},
		],
		primary_action_label: __("Add"),
		primary_action(values) {
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
						3
					);
					window.location.reload();
				},
			});
			course_modal.hide();
		},
	});
	course_modal.show();
	setTimeout(() => {
		$(".modal-body").css("min-height", "200px");
		$(".modal-body input").focus();
	}, 1000);
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
					3
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
			},
			{
				fieldtype: "HTML",
				fieldname: "instructions",
				label: __("Instructions"),
				options: __(
					"Please ensure a user account exists for the student before adding them to the class. Only users can be enrolled as students."
				),
			},
		],
		primary_action_label: __("Add"),
		primary_action(values) {
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
						3
					);
					window.location.reload();
				},
			});
			student_modal.hide();
		},
	});
	student_modal.show();
	setTimeout(() => {
		$(".modal-body").css("min-height", "200px");
		$(".modal-body input").focus();
	}, 1000);
};
