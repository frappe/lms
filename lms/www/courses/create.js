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

	$(".btn-save-course").click((e) => {
		save_course(e);
	});

	if ($("#description").length) {
		make_editor();
	}

	$("#tags-input").focus((e) => {
		$(e.target).keypress((e) => {
			if (e.which == 13) {
				create_tag(e);
			}
		});
	});

	$(".btn-upload").click((e) => {
		upload_file(e);
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
			title: $("#title").val(),
			short_introduction: $("#intro").val(),
			video_link: $("#video-link").val(),
			image: $(".image-preview").attr("src"),
			description: this.description.fields_dict["description"].value,
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
				window.location.href = `/courses/${data.message}/outline`;
			}, 1000);
		},
	});
};

const make_editor = () => {
	this.description = new frappe.ui.FieldGroup({
		fields: [
			{
				fieldname: "description",
				fieldtype: "Text Editor",
				default: $("#description-data").html(),
			},
		],
		body: $("#description").get(0),
	});
	console.log(this.description);
	this.description.make();
	console.log(this.description);
	$("#description .form-section:last").removeClass("empty-section");
	$("#description .frappe-control").removeClass("hide-control");
	$("#description .form-column").addClass("p-0");
};

const upload_file = (e) => {
	new frappe.ui.FileUploader({
		disable_file_browser: true,
		folder: "Home/Attachments",
		make_attachments_public: true,
		restrictions: {
			allowed_file_types: ["image/*"],
		},
		on_success: (file_doc) => {
			$(e.target)
				.parent()
				.siblings("img")
				.addClass("image-preview")
				.attr("src", file_doc.file_url);
		},
	});
};
