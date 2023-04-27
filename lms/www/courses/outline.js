frappe.ready(() => {
	$("#add-chapter").click((e) => {
		show_chapter_modal(e);
	});

	$(".edit-chapter").click((e) => {
		show_chapter_modal(e);
	});

	$("#save-chapter").click((e) => {
		save_chapter(e);
	});
});

const show_chapter_modal = (e) => {
	e.preventDefault();
	$("#chapter-modal").modal("show");
	let parent = $(e.currentTarget).closest(".chapter-container");
	if (parent) {
		$("#chapter-title").val($.trim(parent.find(".chapters-title").text()));
		$("#chapter-description").val(
			$.trim(parent.find(".chapter-description").text())
		);
		$("#chapter-modal").data("chapter", parent.data("chapter"));
		$("#chapter-modal").data("idx", parent.data("idx"));
	}
};

const save_chapter = (e) => {
	let parent = $("#chapter-modal");

	frappe.call({
		method: "lms.lms.doctype.lms_course.lms_course.save_chapter",
		args: {
			course: $("#course-outline").data("course"),
			title: $("#chapter-title").val(),
			chapter_description: $("#chapter-description").val(),
			idx: parent.data("idx") || $(".chapter-container").length + 1,
			chapter: parent.data("chapter") || null,
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
