frappe.ready(() => {
	$(".tags").click((e) => {
		e.preventDefault();
		$("#tags-input").focus();
	});

	$("#tags-input").focusout((e) => {
		create_tag(e);
	});

	$(document).on("click", ".btn-remove", (e) => {
		$(e.target).parent().parent().remove();
	});

	$("#image").change((e) => {
		$(e.target)
			.parent()
			.siblings("img")
			.addClass("image-preview")
			.attr("src", URL.createObjectURL(e.target.files[0]));
	});

	$(".btn-save-course").click((e) => {
		save_course(e);
	});
});

const create_tag = (e) => {
	if ($(e.target).val() == "") {
		return;
	}
	let tag = `<button class="btn btn-secondary btn-sm mr-2 text-uppercase">
		${$(e.target).val()}
		<span class="btn-remove">
			<svg class="icon  icon-sm">
				<use class="" href="#icon-close"></use>
			</svg>
		</span>
	</button>`;
	$(tag).insertBefore("#tags-input");
	$(e.target).val("");
};

const save_course = (e) => {
	let tags = $(".tags button")
		.map((i, el) => $(el).text().trim())
		.get();

	frappe.call({
		method: "lms.lms.doctype.lms_course.lms_course.save_course",
		args: {
			tags: tags.join(", "),
			title: $("#title").text(),
			short_introduction: $("#intro").text(),
			video_link: $("#video-link").text(),
			image: $("#image").attr("href"),
			description: this.code_field_group.fields_dict["code_md"].value,
			course: $("#title").data("course")
				? $("#title").data("course")
				: "",
			published: $("#published").prop("checked") ? 1 : 0,
			upcoming: $("#upcoming").prop("checked") ? 1 : 0,
		},
		callback: (data) => {
			frappe.show_alert({
				message: __("Saved"),
				indicator: "green",
			});
			setTimeout(() => {
				window.location.href = `/courses/${data.message}?edit=1`;
			}, 1000);
		},
	});
};
