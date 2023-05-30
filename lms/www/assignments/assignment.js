frappe.ready(() => {
	if ($("#question").length) {
		make_editor();
	}

	$(".btn-save-assignment").click((e) => {
		save_assignment(e);
	});
});

const make_editor = () => {
	this.question = new frappe.ui.FieldGroup({
		fields: [
			{
				fieldname: "question",
				fieldtype: "Text Editor",
				default: $("#question-data").html(),
			},
		],
		body: $("#question").get(0),
	});
	this.question.make();
	$("#question .form-section:last").removeClass("empty-section");
	$("#question .frappe-control").removeClass("hide-control");
	$("#question .form-column").addClass("p-0");
};

const save_assignment = (e) => {
	frappe.call({
		method: "lms.lms.doctype.lms_assignment.lms_assignment.save_assignment",
		args: {
			assignment: $(e.currentTarget).data("assignment") || "",
			title: $("#title").val(),
			question: this.question.fields_dict["question"].value,
			type: $("#type").val(),
		},
		callback: (data) => {
			frappe.show_alert({
				message: __("Saved"),
				indicator: "green",
			});
			setTimeout(() => {
				window.location.href = `/assignments/${data.message}`;
			}, 2000);
		},
	});
};
