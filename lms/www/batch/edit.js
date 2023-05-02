frappe.ready(() => {
	let self = this;
	setup_editor();
	fetch_quiz_list();

	$("#save-lesson").click((e) => {
		save_lesson(e);
	});
});

const setup_editor = () => {
	self.editor = new EditorJS({
		holder: "lesson-content",
		tools: {
			youtube: YouTubeVideo,
			quiz: Quiz,
		},
	});
};

const save_lesson = (e) => {
	self.editor.save().then((outputData) => {
		parse_lesson(outputData);
	});
};

const fetch_quiz_list = () => {
	frappe.call({
		method: "lms.lms.doctype.lms_quiz.lms_quiz.get_user_quizzes",
		callback: (r) => {
			self.quiz_list = r.message;
		},
	});
};

const parse_lesson = (data) => {};

class YouTubeVideo {
	static get toolbox() {
		return {
			title: "YouTube Video",
		};
	}

	render() {
		let self = this;
		this.wrapper = document.createElement("div");
		let youtubedialog = new frappe.ui.Dialog({
			title: __("YouTube Video"),
			fields: [
				{
					fieldname: "youtube",
					fieldtype: "Data",
					label: __("YouTube Video ID"),
					reqd: 1,
				},
			],
			primary_action_label: __("Insert"),
			primary_action(values) {
				youtubedialog.hide();
				self.youtube = values.youtube;
				$(self.wrapper).html(` <iframe width="100%" height="400"
				src="https://www.youtube.com/embed/${self.youtube}"
				title="YouTube video player"
				frameborder="0"
				style="border-radius: var(--border-radius-lg); margin: 1rem 0;"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				allowfullscreen>
			</iframe>`);
			},
		});
		youtubedialog.show();
		return this.wrapper;
	}

	save(block_content) {
		return {
			youtube: this.youtube,
		};
	}
}

class Quiz {
	static get toolbox() {
		return {
			title: "Quiz",
		};
	}

	render() {
		this.wrapper = document.createElement("div");
		let self = this;
		let quizdialog = new frappe.ui.Dialog({
			title: __("Select a Quiz"),
			fields: [
				{
					fieldname: "quiz",
					fieldtype: "Link",
					label: __("Quiz"),
					reqd: 1,
					options: "LMS Quiz",
				},
			],
			primary_action_label: __("Insert"),
			primary_action(values) {
				self.quiz = values.quiz;
				quizdialog.hide();
				$(self.wrapper).html(
					`<div class="common-card-style p-2 my-2 bold-heading">
						Quiz: ${self.quiz}
					</div>`
				);
			},
		});
		quizdialog.show();
		setTimeout(() => {
			$(".modal-body").css("min-height", "300px");
			$(".modal-body input").focus();
		}, 1000);
		return this.wrapper;
	}

	save(block_content) {
		return {
			quiz: this.quiz,
		};
	}
}

class Video {
	static get toolbox() {
		return {
			title: "Video",
		};
	}

	render() {
		this.wrapper = document.createElement("div");
		let self = this;
		new frappe.ui.FileUploader({
			disable_file_browser: true,
			folder: "Home/Attachments",
			make_attachments_public: true,
			restrictions: {
				allowed_file_types: ["video/*"],
			},
			on_success: (file_doc) => {
				$(e.target)
					.parent()
					.siblings("img")
					.addClass("image-preview")
					.attr("src", file_doc.file_url);
			},
		});
	}
}
