// Copyright (c) 2021, FOSS United and contributors
// For license information, please see license.txt

frappe.ui.form.on('Course Lesson', {
    setup: function (frm) {
        frm.trigger('setup_help');
    },
    setup_help(frm) {
        frm.get_field('help').html(`
            <p>${__("You can add some more additional content to the lesson using a special syntax. The table below mentions all types of dynamic content that you can add to the lessons and the syntax for the same.")}</p>
            <div class="row font-weight-bold mb-3">
                <div class="col-sm-8">
                    ${__("Content Type")}
                </div>
                <div class="col-sm-4">
                    ${__("Syntax")}
                </div>
            </div>

            <div class="row mb-3">
                <div class="col-sm-8">
                    ${__("Video")}
                </div>
                <div class="col-sm-4">
                    {{ Video("url_of_source") }}
                </div>
            </div>

            <div class="row mb-3">
                <div class="col-sm-8">
                    ${__("YouTube Video")}
                </div>
                <div class="col-sm-4">
                    {{ YouTubeVideo("unique_embed_id") }}
                </div>
            </div>

            <div class="row mb-3">
                <div class="col-sm-8">
                    ${"Exercise"}
                </div>
                <div class="col-sm-4">
                    {{ Exercise("exercise_name") }}
                </div>
            </div>

            <div class="row mb-3">
                <div class="col-sm-8">
                    ${__("Quiz")}
                </div>
                <div class="col-sm-4">
                    {{ Quiz("lms_quiz_name") }}
                </div>
            </div>

            <div class="row mb-3">
                <div class="col-sm-8">
                    ${__("Assignment")}
                </div>
                <div class="col-sm-4">
                    {{ Assignment("id-filetype") }}
                </div>
            </div>

            <hr>

            <div class="row font-weight-bold mb-3">
                <div class="col-sm-8">
                    ${__("Supported File Types for Assignment")}
                </div>
                <div class="col-sm-4">
                    ${__("Syntax")}
                </div>
            </div>

            <div class="row mb-3">
                <div class="col-sm-8">
                    .doc,.docx,.xml,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document
                </div>
                <div class="col-sm-4">
                    ${__("Document")}
                </div>
            </div>

            <div class="row mb-3">
                <div class="col-sm-8">
                    .pdf
                </div>
                <div class="col-sm-4">
                    ${__("PDF")}
                </div>
            </div>

            <div class="row mb-3">
                <div class="col-sm-8">
                    .png, .jpg, .jpeg
                </div>
                <div class="col-sm-4">
                    ${__("Image")}
                </div>
            </div>
        `);
    }
});
