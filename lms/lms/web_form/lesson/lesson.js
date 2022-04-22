frappe.ready(function() {

    frappe.web_form.after_load = () => {
        add_file_upload_component();
    };

    frappe.web_form.after_save = () => {
      show_success_message();
    };

    $(document).on("click", ".add-attachment", (e) => {
        show_upload_modal();
    });

    $(document).on("click", ".copy-link", (e) => {
        frappe.utils.copy_to_clipboard($(e.currentTarget).data("link"));
    });

});

const show_upload_modal = () => {
    new frappe.ui.FileUploader({
        folder: "Home/Attachments",
        restrictions: {
            allowed_file_types: ['image/*']
        },
        on_success: (file_doc) => {
            $(".attachments").append(build_attachment_table(file_doc));
            let count = $(".attachment-count").data("count") + 1;
            $(".attachment-count").data("count", count);
            $(".attachment-count").html(__(`${count} attachments`));
            $(".attachments").removeClass("hide");
        },
    });
};

const show_success_message = () => {
    frappe.call({
        method: "lms.lms.doctype.course_lesson.course_lesson.get_lesson_info",
        args: {
            "chapter": frappe.web_form.doc.chapter
        },
        callback: (data) => {
            frappe.msgprint(__(`Lesson has been saved successfully. Go back to the chapter and add this lesson to the lessons table.`));
            setTimeout(() => {
                window.location.href = `/courses/${data.message}`;
            }, 3000);
        }
    });
};

const add_file_upload_component = () => {
    $(get_attachment_controls_html()).insertBefore($(`[data-fieldname="include_in_preview"]`).first());
};

const get_attachment_controls_html = () => {
    return `
        <div class="attachments-parent">
            <div class="attachment-controls">
                <div class="show-attachments" data-toggle="collapse" data-target="#collapse-attachments" aria-expanded="false">
                    <svg class="icon icon-sm">
                        <use class="" href="#icon-attachment">
                    </svg>
                    <span class="attachment-count" data-count="0">0 {{ _("attachments") }}</span>
                </div>
                <div class="add-attachment">
                    <span class="button is-secondary">
                        <svg class="icon icon-sm">
                            <use class="" href="#icon-upload">
                        </svg>
                        {{ _("Upload Image") }}
                    </span>
                </div>
            </div>
            <table class="attachments common-card-style collapse hide" id="collapse-attachments"></table>
        </div>
    `;
};

const build_attachment_table = (file_doc) => {
    return $(`
        <tr class="attachment-row">
            <td>${file_doc.file_name}</td>
            <td class=""><a class="button is-secondary button-links copy-link" data-link="![](${file_doc.file_url})"
            data-name="${file_doc.file_name}" > {{ _("Copy Link") }} </a></td>
        </tr>
    `);
};
