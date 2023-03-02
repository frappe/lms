frappe.ready(() => {
	$("#submit-student").click((e) => {
		submit_student(e);
	});

	$(".remove-student").click((e) => {
		remove_student(e);
	});

	$(".class-course").click((e) => {
		update_course(e);
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
});

const submit_student = (e) => {
	e.preventDefault();
	frappe.call({
		method: "lms.lms.doctype.lms_class.lms_class.add_student",
		args: {
			email: $("#student-email").val(),
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

const update_course = (e) => {
	frappe.call({
		method: "lms.lms.doctype.lms_class.lms_class.update_course",
		args: {
			course: $(e.currentTarget).data("course"),
			value: $(e.currentTarget).children("input").prop("checked") ? 1 : 0,
			class_name: $(".class-details").data("class"),
		},
	});
};

const create_live_class = (e) => {
	frappe.call({
		method: "lms.lms.doctype.lms_class.lms_class.create_live_class",
		args: {
			class_name: $(".class-details").data("class"),
			title: $("input[data-fieldname='meeting_title']").val(),
			duration: $("input[data-fieldname='meeting_duration']").val(),
			date: $("input[data-fieldname='meeting_date']").val(),
			time: $("input[data-fieldname='meeting_time']").val(),
			description: $(
				"textarea[data-fieldname='meeting_description']"
			).val(),
		},
		callback: (data) => {
			$("#live-class-modal").modal("hide");
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
				fieldtype: "Datetime",
				options: "",
				label: "Date and Time",
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
