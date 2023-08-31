frappe.ready(() => {
	let self = this;
	this.quiz_in_lesson = [];

	frappe.telemetry.capture("on_lesson_creation_page", "lms");

	if ($("#instructor-notes").length) {
		frappe.require("controls.bundle.js", () => {
			make_instructor_notes_component();
		});
	}

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
			embed: {
				class: Embed,
				config: {
					services: {
						youtube: true,
						vimeo: true,
						codepen: true,
						slides: {
							regex: /https:\/\/docs\.google\.com\/presentation\/d\/e\/([A-Za-z0-9_-]+)\/pub/,
							embedUrl:
								"https://docs.google.com/presentation/d/e/<%= remote_id %>/embed",
							html: "<iframe width='100%' height='300' frameborder='0' allowfullscreen='true'></iframe>",
						},
						pdf: {
							regex: /(https?:\/\/.*\.pdf)/,
							embedUrl: "<%= remote_id %>",
							html: "<iframe width='100%' height='600px' frameborder='0'></iframe>",
						},
					},
				},
			},
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
			this.quiz_in_lesson.push(quiz);
			lesson_blocks.push({
				type: "quiz",
				data: {
					quiz: [quiz],
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
		} else if (block.includes("{{ Embed")) {
			let embed = block.match(/'([^']+)'/)[1];
			lesson_blocks.push({
				type: "embed",
				data: {
					service: embed.split("|||")[0],
					embed: embed.split("|||")[1],
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
			block.data.quiz.forEach((quiz) => {
				lesson_content += `{{ Quiz("${quiz}") }}\n`;
			});
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
		} else if (block.type == "embed") {
			if (block.data.service == "pdf") {
				if (!block.data.embed.startsWith(window.location.origin)) {
					frappe.throw(__("Invalid PDF URL"));
				}
			}
			lesson_content += `{{ Embed("${
				block.data.service
			}|||${block.data.embed.replace(/&amp;/g, "&")}") }}\n`;
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
			instructor_notes:
				this.instructor_notes.get_values().instructor_notes,
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
		let me = this;
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
				me.youtube = values.youtube;
				$(me.wrapper).html(me.render_youtube(values.youtube));
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

	validate(savedData) {
		return !savedData.youtube || !savedData.youtube.trim() ? false : true;
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

	get_fields() {
		let fields = [
			{
				fieldname: "start_section",
				fieldtype: "Section Break",
				label: __(
					"To create a new quiz, click on the button below. Once you have created the new quiz you can come back to this lesson and add it from here."
				),
			},
			{
				fieldname: "create_quiz",
				fieldtype: "Button",
				label: __("Create Quiz"),
				click: () => {
					window.location.href = "/quizzes";
				},
			},
			{
				fieldname: "quiz_information",
				fieldtype: "HTML",
				options: __("OR"),
			},
			{
				fieldname: "quiz_list_section",
				fieldtype: "Section Break",
				label: __("Select a exisitng quiz to add to this lesson."),
			},
		];
		let break_index = Math.ceil(self.quiz_list.length / 2) + 4;

		self.quiz_list.forEach((quiz) => {
			fields.push({
				fieldname: quiz.name,
				fieldtype: "Check",
				label: quiz.title,
				default: self.quiz_in_lesson.includes(quiz.name) ? 1 : 0,
				read_only: self.quiz_in_lesson.includes(quiz.name) ? 1 : 0,
			});
		});

		fields.splice(break_index, 0, {
			fieldname: "column_break",
			fieldtype: "Column Break",
		});
		return fields;
	}

	render() {
		this.wrapper = document.createElement("div");
		if (this.data && this.data.quiz) {
			$(this.wrapper).html(this.render_quiz());
		} else {
			this.render_quiz_dialog();
		}
		return this.wrapper;
	}

	render_quiz_dialog() {
		let me = this;
		let fields = this.get_fields();
		let quizdialog = new frappe.ui.Dialog({
			title: __("Manage Quiz"),
			fields: fields,
			primary_action_label: __("Insert"),
			primary_action(values) {
				me.analyze_quiz_list(values);
				quizdialog.hide();
			},
			secondary_action_label: __("Create New Quiz"),
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

	analyze_quiz_list(values) {
		/* If quiz is selected and is not already in the lesson then render it.*/

		this.quiz_to_render = [];
		Object.keys(values).forEach((key) => {
			if (values[key] === 1 && !self.quiz_in_lesson.includes(key)) {
				self.quiz_in_lesson.push(key);
				this.quiz_to_render.push(key);
			}
		});

		$(this.wrapper).html(this.render_quiz());
	}

	render_quiz() {
		let html = ``;
		let quiz_list = this.data.quiz || this.quiz_to_render;
		quiz_list.forEach((quiz) => {
			html += `<div class="common-card-style p-2 my-2 bold-heading">
				Quiz: ${quiz}
			</div>`;
		});
		return html;
	}

	validate(savedData) {
		return !savedData.quiz || !savedData.quiz.length ? false : true;
	}

	save(block_content) {
		return {
			quiz: this.data.quiz || this.quiz_to_render,
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

	validate(savedData) {
		return !savedData.file_url || !savedData.file_url.trim() ? false : true;
	}

	save(block_content) {
		return {
			file_url: this.data.file_url || this.file_url,
			is_video: this.is_video,
		};
	}
}

const make_instructor_notes_component = () => {
	this.instructor_notes = new frappe.ui.FieldGroup({
		fields: [
			{
				fieldname: "instructor_notes",
				fieldtype: "Text Editor",
				default: $("#current-instructor-notes").html(),
			},
		],
		body: $("#instructor-notes").get(0),
	});
	this.instructor_notes.make();
	$("#instructor-notes .form-section:last").removeClass("empty-section");
	$("#instructor-notes .frappe-control").removeClass("hide-control");
	$("#instructor-notes .form-column").addClass("p-0");
};
