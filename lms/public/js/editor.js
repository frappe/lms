import EditorJS from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";

const create_editor_for_short_description = () => {
	let editor = new EditorJS({
		holder: "course-description",
		tools: {
			header: {
				class: Header,
			},
			list: List,
		},
	});
};
