frappe.ready(() => {
	frappe.require("controls.bundle.js");

	$(".btn-add-course").click((e) => {
		show_course_modal(e);
	});

	$(".btn-edit-course").click((e) => {
		show_course_modal(e);
	});

	$(".btn-remove-course").click((e) => {
		remove_course(e);
	});
});

const show_course_modal = (e) => {
	const target = $(e.currentTarget);
	const course = target.data("course");
	const evaluator = target.data("evaluator");
	const course_name = target.data("name");

	let course_modal = new frappe.ui.Dialog({
		title: "Add Course",
		fields: [
			{
				fieldtype: "Link",
				options: "LMS Course",
				label: __("Course"),
				fieldname: "course",
				reqd: 1,
				only_select: 1,
				default: course || "",
				read_only: course ? 1 : 0,
			},
			{
				fieldtype: "Link",
				options: "Course Evaluator",
				label: __("Course Evaluator"),
				fieldname: "evaluator",
				only_select: 1,
				default: evaluator || "",
			},
		],
		primary_action_label: __("Add"),
		primary_action(values) {
			add_course(values, course_name);
			course_modal.hide();
		},
	});
	course_modal.show();
	setTimeout(() => {
		$(".modal-body").css("min-height", "300px");
	}, 1000);
};

const add_course = (values, course_name) => {
	frappe.call({
		method: "lms.lms.doctype.lms_batch.lms_batch.add_course",
		args: {
			course: values.course,
			evaluator: values.evaluator,
			parent: $(".class-details").data("batch"),
			name: course_name || "",
		},
		callback(r) {
			frappe.show_alert(
				{
					message: course_name
						? __("Course Updated")
						: __("Course Added"),
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
			method: "lms.lms.doctype.lms_batch.lms_batch.remove_course",
			args: {
				course: $(e.currentTarget).data("course"),
				parent: $(".class-details").data("batch"),
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
