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
