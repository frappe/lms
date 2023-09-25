frappe.ready(() => {
	frappe.telemetry.capture("on_course_creation_page", "lms");
	$(".tags").click((e) => {
		e.preventDefault();
		$("#tags-input").focus();
	});

	$("#tags-input").focusout((e) => {
		create_tag(e);
	});

	$("#tags-input").focus((e) => {
		$(e.target).keypress((e) => {
			if (e.which == 13 || e.which == 44) {
				create_tag(e);
				setTimeout(() => {
					$("#tags-input").val("");
				}, 0);
			}
		});
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

	$(".field-input").focusout((e) => {
		if ($(e.currentTarget).siblings(".error-message")) {
			$(e.currentTarget).siblings(".error-message").remove();
		}
	});

	$(".btn-upload").click((e) => {
		upload_file(e);
	});

	$("#paid-course").click((e) => {
		setup_paid_course(e);
	});
});

const create_tag = (e) => {
	if ($(e.target).val() == "") {
		return;
	}

	let tag_value = $(e.target)
		.val()
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
	let tag = `<button class="btn btn-secondary btn-sm mr-2 text-uppercase">
		${tag_value}
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
	validate_mandatory();
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
			paid_course: $("#paid-course").prop("checked") ? 1 : 0,
			course_price: $("#course-price").val(),
			currency: $("#currency").val(),
		},
		callback: (data) => {
			frappe.show_alert({
				message: __("Saved"),
				indicator: "green",
			});
			setTimeout(() => {
				window.location.href = `/courses/${data.message}/edit`;
			}, 1000);
		},
	});
};

const validate_mandatory = () => {
	let fields = $(".field-label.reqd");
	fields.each((i, el) => {
		let input = $(el).closest(".field-group").find(".field-input");
		if (input.length && input.val().trim() == "") {
			if (input.siblings(".error-message").length == 0) {
				scroll_to_element(input);
				throw_error(el, input);
			}
			throw `${$(el).text().trim()} is mandatory`;
		}
	});

	if (!strip_html(this.description.fields_dict["description"].value)) {
		scroll_to_element("#description");
		throw_error(
			"#description",
			this.description.fields_dict["description"].parent
		);
		throw "Description is mandatory";
	}
};

const throw_error = (el, input) => {
	let error = document.createElement("p");
	error.classList.add("error-message");
	error.innerText = `Please enter a ${$(el).text().trim()}`;
	$(error).insertAfter($(input));
};

const scroll_to_element = (element) => {
	if ($(element).length) {
		$([document.documentElement, document.body]).animate(
			{
				scrollTop: $(element).offset().top - 100,
			},
			1000
		);
	}
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
	this.description.make();
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

const setup_paid_course = (e) => {
	if ($(e.target).prop("checked")) {
		$(".price-field").removeClass("hide");
		$(".price-field").find(".field-label").addClass("reqd");
	} else {
		$(".price-field").addClass("hide");
		$(".price-field").find(".field-label").removeClass("reqd");
	}
};
