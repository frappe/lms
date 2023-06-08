frappe.ready(() => {
	frappe.telemetry.capture("on_course_outline_page", "lms");
	$(".btn-add-chapter").click((e) => {
		show_chapter_modal(e);
	});

	$(".edit-chapter").click((e) => {
		show_chapter_modal(e);
	});

	$("#save-chapter").click((e) => {
		save_chapter(e);
	});

	$(".lesson-dropzone").each((i, el) => {
		setSortable(el);
	});

	$(".chapter-dropzone").each((i, el) => {
		setSortable(el);
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
	validate_mandatory();
	let parent = $("#chapter-modal");

	frappe.call({
		method: "lms.lms.doctype.lms_course.lms_course.save_chapter",
		args: {
			course: $("#course-outline").data("course"),
			title: $("#chapter-title").val(),
			chapter_description: $("#chapter-description").val(),
			idx: parent.data("idx") || $(".chapter-container").length,
			chapter: parent.data("chapter") || null,
		},
		callback: (data) => {
			$("#chapter-modal").modal("hide");
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

const validate_mandatory = () => {
	if (!$("#chapter-title").val()) {
		let error = $("p")
			.addClass("error-message")
			.text("Chapter title is required");
		$(error).insertAfter("#chapter-title");
		throw __("Chapter title is required");
	}
};

const setSortable = (el) => {
	new Sortable(el, {
		group: "drag",
		handle: ".drag-handle",
		animation: 150,
		fallbackOnBody: true,
		swapThreshold: 0.65,
		onEnd: (e) => {
			if ($(e.item).hasClass("outline-lesson")) reorder_lesson(e);
			else reorder_chapter(e);
		},
		onMove: (e) => {
			if (
				$(e.dragged).hasClass("outline-lesson") &&
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

const reorder_lesson = (e) => {
	let old_chapter = $(e.from).closest(".chapter-container").data("chapter");
	let new_chapter = $(e.to).closest(".chapter-container").data("chapter");

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
