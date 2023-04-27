import EditorJS from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";

let self = this;
const create_editor_for_lesson_content = () => {
	self.editor = new EditorJS({
		holder: "lesson-content",
		tools: {
			header: {
				class: Header,
			},
			list: List,
		},
	});
};

create_editor_for_lesson_content();
console.log(self.editor);
