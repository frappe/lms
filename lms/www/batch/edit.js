frappe.ready(() => {
	let self = this;
	if ($("#current-lesson-content").length) {
		parse_string_to_lesson();
	}

	setup_editor();
	fetch_quiz_list();

	$("#save-lesson").click((e) => {
		save_lesson(e);
	});
});

const parse_string_to_lesson = () => {
	let lesson_content = $("#current-lesson-content").html();
	let lesson_blocks = [];

	lesson_content.split("\n").forEach((block) => {
		if (block.includes("{{ YouTubeVideo")) {
			let youtube_id = block.match(/'([^']+)'/)[1];
			lesson_blocks.push({
				type: "youtube",
				data: {
					youtube: youtube_id,
				},
			});
		} else if (block.includes("{{ Quiz")) {
			let quiz = block.match(/'([^']+)'/)[1];
			lesson_blocks.push({
				type: "quiz",
				data: {
					quiz: quiz,
				},
			});
		} else {
			lesson_blocks.push({
				type: "paragraph",
				data: {
					text: block,
				},
			});
		}
	});

	this.blocks = lesson_blocks;
};

const setup_editor = () => {
	self.editor = new EditorJS({
		holder: "lesson-content",
		tools: {
			youtube: YouTubeVideo,
			quiz: Quiz,
			paragraph: {
				class: Paragraph,
				inlineToolbar: true,
				config: {
					preserveBlank: true,
				},
			},
		},
		data: {
			blocks: self.blocks ? self.blocks : [],
		},
	});
};

const save_lesson = (e) => {
	self.editor.save().then((outputData) => {
		parse_lesson_to_string(outputData);
	});
};

const parse_lesson_to_string = (data) => {
	let lesson_content = "";
	data.blocks.forEach((block) => {
		if (block.type == "youtube") {
			lesson_content += `{{ YouTubeVideo("${block.data.youtube}") }}\n`;
		} else if (block.type == "quiz") {
			lesson_content += `{{ Quiz("${block.data.quiz}") }}\n`;
		} else if (block.type == "paragraph") {
			lesson_content += `${block.data.text}\n`;
		}
	});
	save(lesson_content);
};

const save = (lesson_content) => {
	let lesson = $("#lesson-title").data("lesson");

	frappe.call({
		method: "lms.lms.doctype.lms_course.lms_course.save_lesson",
		args: {
			title: $("#lesson-title").val(),
			body: lesson_content,
			chapter: $("#lesson-title").data("chapter"),
			preview: 0,
			idx: $("#lesson-title").data("index"),
			lesson: lesson ? lesson : "",
		},
		callback: (data) => {
			frappe.show_alert({
				message: __("Saved"),
				indicator: "green",
			});
			setTimeout(() => {
				window.location.href = window.location.href.split("?")[0];
			}, 1000);
		},
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

class YouTubeVideo {
	constructor({ data }) {
		this.data = data;
	}

	static get toolbox() {
		return {
			title: "YouTube Video",
		};
	}

	render() {
		this.wrapper = document.createElement("div");
		if (this.data && this.data.youtube) {
			$(this.wrapper).html(this.render_youtube(this.data.youtube));
		} else {
			this.render_youtube_dialog();
		}
		return this.wrapper;
	}

	render_youtube_dialog() {
		let self = this;
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
				$(self.wrapper).html(self.render_youtube(values.youtube));
			},
		});
		youtubedialog.show();
	}

	render_youtube(youtube) {
		return `<iframe width="100%" height="400"
			src="https://www.youtube.com/embed/${youtube}"
			title="YouTube video player"
			frameborder="0"
			style="border-radius: var(--border-radius-lg); margin: 1rem 0;"
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
			allowfullscreen>
		</iframe>`;
	}

	save(block_content) {
		return {
			youtube: this.data.youtube || this.youtube,
		};
	}
}

class Quiz {
	static get toolbox() {
		return {
			title: "Quiz",
		};
	}

	constructor({ data }) {
		this.data = data;
	}

	render() {
		this.wrapper = document.createElement("div");
		if (this.data && this.data.quiz) {
			$(this.wrapper).html(this.render_quiz(this.data.quiz));
		} else {
			this.render_quiz_dialog();
		}
		return this.wrapper;
	}

	render_quiz_dialog() {
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
				$(self.wrapper).html(self.render_quiz(self.quiz));
			},
		});
		quizdialog.show();
		setTimeout(() => {
			$(".modal-body").css("min-height", "300px");
			$(".modal-body input").focus();
		}, 1000);
	}

	render_quiz(quiz) {
		return `<div class="common-card-style p-2 my-2 bold-heading">
			Quiz: ${quiz}
		</div>`;
	}

	save(block_content) {
		return {
			quiz: this.data.quiz || this.quiz,
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
