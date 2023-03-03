// Copyright (c) 2021, FOSS United and contributors
// For license information, please see license.txt

frappe.ui.form.on("Course Lesson", {
	setup: function (frm) {
		frm.trigger("setup_help");
	},
	setup_help(frm) {
		let quiz_link = `<a href="/app/lms-quiz"> ${__("Quiz List")} </a>`;
		let exercise_link = `<a href="/app/lms-exercise"> ${__(
			"Exercise List"
		)} </a>`;
		let file_link = `<a href="/app/file"> ${__("File DocType")} </a>`;

		frm.get_field("help").html(`
            <p>${__(
				"You can add some more additional content to the lesson using a special syntax. The table below mentions all types of dynamic content that you can add to the lessons and the syntax for the same."
			)}</p>
            <table class="table">
                <tr style="background-color: var(--fg-hover-color); font-weight: bold">
                    <th style="width: 20%;">
                        ${__("Content Type")}
                    </th>
                    <th style="width: 40%;">
                        ${__("Syntax")}
                    </th>
                    <th>
                        ${__("Description")}
                    </th>
                </tr>
                <tr>
                    <td>
                        ${__("YouTube Video")}
                    </td>
                    <td>
                        {{ YouTubeVideo("unique_embed_id") }}
                    </td>
                    <td>
                        <span>
                            ${__(
								"Copy and paste the syntax in the editor. Replace 'embed_src' with the embed source that YouTube provides. To get the source, follow the steps mentioned below."
							)}
                        </span>
                        <ul class="p-4">
                            <li>
                                ${__("Upload the video on youtube.")}
                            </li>
                            <li>
                                ${__(
									"When you share a youtube video, it shows an option called Embed."
								)}
                            </li>
                            <li>
                                ${__(
									"On clicking it, it provides an iframe. Copy the source (src) of the iframe and paste it here."
								)}
                            </li>
                        </ul>
                    </td>
                </tr>
                <tr>
                    <td>
                        ${__("Quiz")}
                    </td>
                    <td>
                        {{ Quiz("lms_quiz_id") }}
                    </td>
                    <td>
                        ${__(
							"Copy and paste the syntax in the editor. Replace 'lms_quiz_id' with the ID of the Quiz you want to add. You can get the ID of the quiz from the {0}.",
							[quiz_link]
						)}
                    </td>
                </tr>
                <tr>
                    <td>
                        ${__("Video")}
                    </td>
                    <td>
                        {{ Video("url_of_source") }}
                    </td>
                    <td>
                        ${__(
							"Upload a video from your local machine to the {0}. Copy and paste this syntax in the editor. Replace 'url_of_source' with the File URL field of the document you created in the File DocType.",
							[file_link]
						)}
                    </td>
                </tr>
                <tr>
                    <td>
                        ${"Exercise"}
                    </td>
                    <td>
                        {{ Exercise("exercise_id") }}
                    </td>
                    <td>
                        ${__(
							"Copy and paste the syntax in the editor. Replace 'exercise_id' with the ID of the Exercise you want to add. You can get the ID of the exercise from the {0}.",
							[exercise_link]
						)}
                    </td>
                </tr>
                <tr>
                    <td>
                        ${__("Assignment")}
                    </td>
                    <td>
                        {{ Assignment("id-filetype") }}
                    </td>
                </tr>
            </table>
            <hr>
            <table class="table">
                <tr style="background-color: var(--fg-hover-color); font-weight: bold">
                    <th style="width: 90%">
                        ${__("Supported File Types for Assignment")}
                    </th>
                    <th>
                        ${__("Syntax")}
                    </th>
                </tr>
                <tr>
                    <td>
                        .doc, .docx, .xml
                    <td>
                        ${__("Document")}
                    </td>
                </tr>
                <tr>
                    <td>
                        .pdf
                    </td>
                    <td>
                        ${__("PDF")}
                    </td>
                </tr>
                <tr>
                    <td>
                        .png, .jpg, .jpeg
                    </td>
                    <td>
                        ${__("Image")}
                    </td>
                </tr>
            </table>
        `);
	},
});
