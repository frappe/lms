frappe.ready(() => {
	$(".btn-upload").click((e) => {
		upload_file(e);
	});

	$(".btn-save-assignment").click((e) => {
		save_assignment(e);
	});

	$(".btn-close").click((e) => {
		clear_preview(e);
	});
});

const upload_file = (e) => {
	let type = $(e.currentTarget).data("type");
	let mapper = {
		Image: "image/*",
		Document:
			".doc,.docx,.xml,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		PDF: ".pdf",
	};

	new frappe.ui.FileUploader({
		disable_file_browser: true,
		folder: "Home/Attachments",
		make_attachments_public: true,
		restrictions: {
			allowed_file_types: [mapper[type]],
		},
		on_success: (file_doc) => {
			$(e.currentTarget).addClass("hide");
			$(".file-source-preview .btn-close").removeClass("hide");
			$(".file-source-preview iframe")
				.attr("src", file_doc.file_url)
				.removeClass("hide");
		},
	});
};

const save_assignment = (e) => {
	let file = $(".image-preview").attr("src");
	if (!file) {
		frappe.throw({
			title: __("No File"),
			message: __("Please upload a file."),
		});
	}

	frappe.call({
		method: "lms.lms.doctype.lms_assignment_submission.lms_assignment_submission.upload_assignment",
		args: {
			assignment: $(e.currentTarget).data("assignment"),
			assignment_attachment: file,
		},
		callback: (data) => {
			frappe.show_alert({
				message: __("Saved"),
				indicator: "green",
			});
			setTimeout(() => {
				window.location.href = `/assignment-submission/${$(
					e.currentTarget
				).data("assignment")}/${data.message}`;
			}, 2000);
		},
	});
};

const clear_preview = (e) => {
	$(".file-source-preview .btn-upload").removeClass("hide");
	$(".file-source-preview iframe").attr("src", "").addClass("hide");
	$(".file-source-preview .btn-close").addClass("hide");
};
