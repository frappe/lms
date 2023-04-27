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
		console.log(outputData);
	});
};

class YouTubeVideo {
	static get toolbox() {
		return {
			title: "YouTube Video",
		};
	}

	render() {
		this.wrapper = document.createElement("div");
		$(this.wrapper).html(`<div class="field-group">
            <div class="">
                <input id="youtube" type="text" class="field-input">
            </div>
        </div>`);
		return this.wrapper;
	}

	save(block_content) {
		return {
			youtube: $("#youtube").val(),
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
		$(this.wrapper).html(
			`<div>
                <select id="quiz" class="field-input">
                    <option value="">Select Quiz</option>
                </select>
            </div>`
		);
		self.quiz_list.forEach((quiz) => {
			$(this.wrapper)
				.find("#quiz")
				.append(`<option value="${quiz.name}">${quiz.title}</option>`);
		});

		return this.wrapper;
	}
}

const fetch_quiz_list = () => {
	frappe.call({
		method: "lms.lms.doctype.lms_quiz.lms_quiz.get_user_quizzes",
		callback: (r) => {
			self.quiz_list = r.message;
		},
	});
};
