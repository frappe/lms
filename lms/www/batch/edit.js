frappe.ready(() => {
	let self = this;
	frappe.require("controls.bundle.js");
	frappe.telemetry.capture("on_lesson_creation_page", "lms");

	if ($("#current-lesson-content").length) {
		parse_string_to_lesson("lesson");
	}

	if ($("#current-instructor-notes").length) {
		parse_string_to_lesson("notes");
	}

	setup_editor_for_lesson_content();
	setup_editor_for_instructor_notes();

	$("#save-lesson").click((e) => {
		save_lesson(e);
	});
});

const setup_editor_for_lesson_content = () => {
	self.editor = new EditorJS({
		holder: "lesson-content",
		tools: get_tools(),
		data: {
			blocks: self.lesson_blocks || [],
		},
	});
};

const setup_editor_for_instructor_notes = () => {
	self.instructor_notes_editor = new EditorJS({
		holder: "instructor-notes",
		tools: get_tools(),
		data: {
			blocks: self.notes_blocks || [],
		},
	});
};

const get_tools = () => {
	return {
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
	};
};

const parse_string_to_lesson = (type) => {
	let content;
	let blocks = [];

	if (type == "lesson") {
		content = $("#current-lesson-content").html();
	} else if (type == "notes") {
		content = $("#current-instructor-notes").html();
	}

	content.split("\n").forEach((block) => {
		if (block.includes("{{ YouTubeVideo")) {
			let youtube_id = block.match(/\(["']([^"']+?)["']\)/)[1];
			blocks.push({
				type: "youtube",
				data: {
					youtube: youtube_id,
				},
			});
		} else if (block.includes("{{ Quiz")) {
			let quiz = block.match(/\(["']([^"']+?)["']\)/)[1];
			blocks.push({
				type: "quiz",
				data: {
					quiz: quiz,
				},
			});
		} else if (block.includes("{{ Video")) {
			let video = block.match(/\(["']([^"']+?)["']\)/)[1];
			blocks.push({
				type: "upload",
				data: {
					file_url: video,
					file_type: "video",
				},
			});
		} else if (block.includes("{{ Audio")) {
			let audio = block.match(/\(["']([^"']+?)["']\)/)[1];
			blocks.push({
				type: "upload",
				data: {
					file_url: audio,
					file_type: "audio",
				},
			});
		} else if (block.includes("{{ PDF")) {
			let pdf = block.match(/\(["']([^"']+?)["']\)/)[1];
			blocks.push({
				type: "upload",
				data: {
					file_url: pdf,
					file_type: "pdf",
				},
			});
		} else if (block.includes("{{ Embed")) {
			let embed = block.match(/\(["']([^"']+?)["']\)/)[1];
			blocks.push({
				type: "embed",
				data: {
					service: embed.split("|||")[0],
					embed: embed.split("|||")[1],
				},
			});
		} else if (block.includes("![]")) {
			let image = block.match(/\((.*?)\)/)[1];
			blocks.push({
				type: "upload",
				data: {
					file_url: image,
					file_type: "image",
				},
			});
		} else if (block.includes("#")) {
			let level = (block.match(/#/g) || []).length;
			blocks.push({
				type: "header",
				data: {
					text: block.replace(/#/g, "").trim(),
					level: level,
				},
			});
		} else {
			blocks.push({
				type: "paragraph",
				data: {
					text: block,
				},
			});
		}
	});

	if (type == "lesson") {
		this.lesson_blocks = blocks;
	} else if (type == "notes") {
		this.notes_blocks = blocks;
	}
};

const save_lesson = (e) => {
	self.editor.save().then((outputData) => {
		parse_content_to_string(outputData, "lesson");

		self.instructor_notes_editor.save().then((outputData) => {
			parse_content_to_string(outputData, "notes");
			save();
		});
	});
};

const parse_content_to_string = (data, type) => {
	let lesson_content = "";
	data.blocks.forEach((block) => {
		if (block.type == "youtube") {
			lesson_content += `{{ YouTubeVideo("${block.data.youtube}") }}\n`;
		} else if (block.type == "quiz") {
			lesson_content += `{{ Quiz("${block.data.quiz}") }}\n`;
		} else if (block.type == "upload") {
			let url = block.data.file_url;
			if (block.data.file_type == "video") {
				lesson_content += `{{ Video("${url}") }}\n`;
			} else if (block.data.file_type == "audio") {
				lesson_content += `{{ Audio("${url}") }}\n`;
			} else if (block.data.file_type == "pdf") {
				lesson_content += `{{ PDF("${url}") }}\n`;
			} else {
				lesson_content += `![](${url})`;
			}
		} else if (block.type == "header") {
			lesson_content +=
				"#".repeat(block.data.level) + ` ${block.data.text}\n`;
		} else if (block.type == "paragraph") {
			lesson_content += `${block.data.text}\n`;
		} else if (block.type == "embed") {
			lesson_content += `{{ Embed("${
				block.data.service
			}|||${block.data.embed.replace(/&amp;/g, "&")}") }}\n`;
		}
	});
	if (type == "lesson") {
		this.lesson_content_data = lesson_content;
	} else if (type == "notes") {
		this.instructor_notes_data = lesson_content;
	}
};

const save = () => {
	validate_mandatory(this.lesson_content_data);
	let lesson = $("#lesson-title").data("lesson");
	frappe.call({
		method: "lms.lms.doctype.lms_course.lms_course.save_lesson",
		args: {
			title: $("#lesson-title").val(),
			body: this.lesson_content_data,
			chapter: decodeURIComponent($("#lesson-title").data("chapter")),
			preview: $("#preview").prop("checked") ? 1 : 0,
			idx: $("#lesson-title").data("index"),
			lesson: lesson ? lesson : "",
			instructor_notes: this.instructor_notes_data,
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

const get_file_type = (url) => {
	let video_types = ["mov", "mp4", "mkv"];
	let video_extension = url.split(".").pop();

	if (video_types.indexOf(video_extension) >= 0) {
		return "video";
	}

	let audio_types = ["mp3", "wav", "ogg"];
	let audio_extension = url.split(".").pop();

	if (audio_types.indexOf(audio_extension) >= 0) {
		return "audio";
	}

	if (url.split(".").pop() == "pdf") {
		return "pdf";
	}

	return "image";
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
		let me = this;
		let quizdialog = new frappe.ui.Dialog({
			title: __("Manage Quiz"),
			fields: [
				{
					fieldname: "quiz",
					fieldtype: "Link",
					label: __("Quiz"),
					options: "LMS Quiz",
					only_select: 1,
				},
			],
			primary_action_label: __("Insert"),
			primary_action(values) {
				me.quiz = values.quiz;
				quizdialog.hide();
				$(me.wrapper).html(me.render_quiz(me.quiz));
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
		return `<a class="common-card-style p-20 my-2 justify-center bold-heading" target="_blank" href=/quizzes/${quiz}>
			Quiz: ${quiz}
		</a>`;
	}

	validate(savedData) {
		return !savedData.quiz || !savedData.quiz.trim() ? false : true;
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
				allowed_file_types: ["image/*", "video/*", "audio/*", ".pdf"],
			},
			on_success: (file_doc) => {
				self.file_url = file_doc.file_url;
				$(self.wrapper).html(self.render_upload(self.file_url));
			},
		});
	}

	render_upload(url) {
		this.file_type = get_file_type(url);
		if (this.file_type == "video") {
			return `<video controls width='100%' controls controlsList='nodownload'>
				<source src=${encodeURI(url)} type='video/mp4'>
			</video>`;
		} else if (this.file_type == "audio") {
			return `<audio controls width='100%' controls controlsList='nodownload'>
				<source src=${encodeURI(url)} type='audio/mp3'>
			</audio>`;
		} else if (this.file_type == "pdf") {
			return `<iframe src="${encodeURI(
				url
			)}#toolbar=0" width='100%' height='700px'></iframe>`;
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
			file_type: this.file_type,
		};
	}
}

const make_instructor_notes_component = () => {
	this.instructor_notes = new frappe.ui.FieldGroup({
		fields: [
			{
				fieldname: "instructor_notes",
				fieldtype: "Text",
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
