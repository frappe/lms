frappe.ready(() => {
	frappe.telemetry.capture("on_lesson_creation_page", "lms");
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

const setup_editor = () => {
	self.editor = new EditorJS({
		holder: "lesson-content",
		tools: {
			header: {
				class: Header,
				inlineToolbar: ["bold", "italic", "link"],
				config: {
					levels: [4, 5, 6],
					defaultLevel: 5,
				},
				icon: `<svg class="icon  icon-sm" style="">
					<use class="" href="#icon-header"></use>
				</svg>`,
			},
			paragraph: {
				class: Paragraph,
				inlineToolbar: true,
				config: {
					preserveBlank: true,
				},
			},
			youtube: YouTubeVideo,
			quiz: Quiz,
			upload: Upload,
		},
		data: {
			blocks: self.blocks ? self.blocks : [],
		},
	});
};

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
		} else if (block.includes("{{ Video")) {
			let video = block.match(/'([^']+)'/)[1];
			lesson_blocks.push({
				type: "upload",
				data: {
					file_url: video,
				},
			});
		} else if (block.includes("![]")) {
			let image = block.match(/\((.*?)\)/)[1];
			lesson_blocks.push({
				type: "upload",
				data: {
					file_url: image,
				},
			});
		} else if (block.includes("#")) {
			let level = (block.match(/#/g) || []).length;
			lesson_blocks.push({
				type: "header",
				data: {
					text: block.replace(/#/g, "").trim(),
					level: level,
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
		} else if (block.type == "upload") {
			let url = block.data.file_url;
			lesson_content += block.data.is_video
				? `{{ Video("${url}") }}\n`
				: `![](${url})`;
		} else if (block.type == "header") {
			lesson_content +=
				"#".repeat(block.data.level) + ` ${block.data.text}\n`;
		} else if (block.type == "paragraph") {
			lesson_content += `${block.data.text}\n`;
		}
	});
	save(lesson_content);
};

const save = (lesson_content) => {
	validate_mandatory(lesson_content);
	let lesson = $("#lesson-title").data("lesson");

	frappe.call({
		method: "lms.lms.doctype.lms_course.lms_course.save_lesson",
		args: {
			title: $("#lesson-title").val(),
			body: lesson_content,
			chapter: $("#lesson-title").data("chapter"),
			preview: $("#preview").prop("checked") ? 1 : 0,
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

const validate_mandatory = (lesson_content) => {
	if (!$("#lesson-title").val()) {
		let error = $("p")
			.addClass("error-message")
			.text(__("Please enter a Lesson Title"));
		$(error).insertAfter("#lesson-title");
		$("#lesson-title").focus();
		throw "Title is mandatory";
	}

	if (!lesson_content.trim()) {
		let error = $("p")
			.addClass("error-message")
			.text(__("Please enter some content for the lesson"));
		$(error).insertAfter("#lesson-content");
		document
			.getElementById("lesson-content")
			.scrollIntoView({ block: "start" });
		throw "Lesson Content is mandatory";
	}
};

const fetch_quiz_list = () => {
	frappe.call({
		method: "lms.lms.doctype.lms_quiz.lms_quiz.get_user_quizzes",
		callback: (r) => {
			self.quiz_list = r.message;
		},
	});
};

const is_video = (url) => {
	let video_types = ["mov", "mp4", "mkv"];
	let video_extension = url.split(".").pop();
	return video_types.indexOf(video_extension) >= 0;
};

class YouTubeVideo {
	constructor({ data }) {
		this.data = data;
	}

	static get toolbox() {
		return {
			title: "YouTube Video",
			icon: `<img src="/assets/lms/icons/video.svg" width="15" height="15">`,
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
				{
					fieldname: "instructions_section_break",
					fieldtype: "Section Break",
					label: __("Instructions:"),
				},
				{
					fieldname: "instructions",
					fieldtype: "HTML",
					label: __("Instructions"),
					options: __(
						"Enter the YouTube Video ID. The ID is the part of the URL after <code>watch?v=</code>. For example, if the URL is <code>https://www.youtube.com/watch?v=QH2-TGUlwu4</code>, the ID is <code>QH2-TGUlwu4</code>"
					),
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
			icon: `<img src="/assets/lms/icons/quiz.svg" width="15" height="15">`,
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
			secondary_action_label: __("Create New"),
			secondary_action: () => {
				window.location.href = `/quizzes`;
			},
		});
		quizdialog.show();
		setTimeout(() => {
			$(".modal-body").css("min-height", "200px");
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

class Upload {
	static get toolbox() {
		return {
			title: "Upload",
			icon: `<img src="/assets/lms/icons/upload.svg" width="15" height="15">`,
		};
	}

	constructor({ data }) {
		this.data = data;
	}

	render() {
		this.wrapper = document.createElement("div");
		if (this.data && this.data.file_url) {
			$(this.wrapper).html(this.render_upload(this.data.file_url));
		} else {
			this.render_upload_dialog();
		}
		return this.wrapper;
	}

	render_upload_dialog() {
		let self = this;
		new frappe.ui.FileUploader({
			disable_file_browser: true,
			folder: "Home/Attachments",
			make_attachments_public: true,
			restrictions: {
				allowed_file_types: ["image/*", "video/*"],
			},
			on_success: (file_doc) => {
				self.file_url = file_doc.file_url;
				$(self.wrapper).html(self.render_upload(self.file_url));
			},
		});
	}

	render_upload(url) {
		this.is_video = is_video(url);
		if (this.is_video) {
			return `<video controls width='100%'>
				<source src=${encodeURI(url)} type='video/mp4'>
			</video>`;
		} else {
			return `<img src=${encodeURI(url)} width='100%'>`;
		}
	}

	save(block_content) {
		return {
			file_url: this.data.file_url || this.file_url,
			is_video: this.is_video,
		};
	}
}
