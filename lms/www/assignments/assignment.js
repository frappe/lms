frappe.ready(() => {
	this.result;
	let self = this;

	set_result();

	$("#save-assignment").click((e) => {
		save_assignment(e);
	});

	$("#result").change((e) => {
		$("#result option:selected").each(function () {
			self.result = $(this).val();
		});
	});
});

const set_result = () => {
	let self = this;
	let result = $("#result").data("type");
	if (result) {
		$("#result option").each((i, elem) => {
			if ($(elem).val() == result) {
				$(elem).attr("selected", true);
				self.result = result;
			}
		});
	}
};

const save_assignment = (e) => {
	e.preventDefault();
	if (!["Pass", "Fail"].includes(this.result))
		frappe.throw({
			title: __("Not Graded"),
			message: __("Please grade the assignment."),
		});
	frappe.call({
		method: "lms.lms.doctype.lesson_assignment.lesson_assignment.grade_assignment",
		args: {
			name: $(e.currentTarget).data("assignment"),
			result: this.result,
			comments: $("#comments").val(),
		},
		callback: (data) => {
			frappe.show_alert({
				message: __("Saved"),
				indicator: "green",
			});
			setTimeout(() => {
				window.history.go(-2);
			}, 2000);
		},
	});
};
