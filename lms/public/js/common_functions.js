frappe.ready(() => {
    $(".join-batch").click((e) => {
        join_course(e);
    });

    $(".notify-me").click((e) => {
        notify_user(e);
    });

    $(".btn-chapter").click((e) => {
        add_chapter(e);
    });

    $(document).on("click", ".btn-save-chapter", (e) => {
        save_chapter(e);
    });

});

const join_course = (e) => {
    e.preventDefault();
    let course = $(e.currentTarget).attr("data-course");
    if (frappe.session.user == "Guest") {
        window.location.href = `/login?redirect-to=/courses/${course}`;
        return;
    }

    let batch = $(e.currentTarget).attr("data-batch");
    batch = batch ? decodeURIComponent(batch) : "";
    frappe.call({
        "method": "lms.lms.doctype.lms_batch_membership.lms_batch_membership.create_membership",
        "args": {
            "batch": batch ? batch : "",
            "course": course
        },
        "callback": (data) => {
            if (data.message == "OK") {
                $(".no-preview-modal").modal("hide");
                frappe.show_alert({
                    message: __("You are now a student of this course."),
                    indicator:'green'
                }, 3);
                setTimeout(function () {
                    window.location.href = `/courses/${course}/learn/1.1`;
                }, 3000);
            }
        }
    })
};


const notify_user = (e) => {
    e.preventDefault();
    var course = decodeURIComponent($(e.currentTarget).attr("data-course"));
    if (frappe.session.user == "Guest") {
        window.location.href = `/login?redirect-to=/courses/${course}`;
        return;
    }

    frappe.call({
        method: "lms.lms.doctype.lms_course_interest.lms_course_interest.capture_interest",
        args: {
            "course": course
        },
        callback: (data) => {
            $(".no-preview-modal").modal("hide");
            frappe.show_alert({
                message: __("You have opted to be notified for this course. You will receive an email when the course becomes available."),
                indicator:'green'
            }, 3);
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        }
    })
};


const add_chapter = (e) => {
    let next_index = $("[data-index]").last().data("index");

    $(`<div class="chapter-parent">
        <div contenteditable="true" data-placeholder="${__('Chapter Name')}" class="chapter-title-main"></div>
        <div class="small my-2" contenteditable="true" data-placeholder="${__('Short Description')}"
        id="chapter-description"></div>
        <button class="btn btn-sm btn-secondary d-block btn-save-chapter mb-8"
        data-index="${next_index}"> ${__('Save')} </button>
        </div>`).insertAfter(`.chapter-parent:last`);

    $(".btn-chapter").attr("disabled", true);
    $([document.documentElement, document.body]).animate({
        scrollTop: $(".chapter-parent:last").offset().top
    }, 1000);

    $(".chapter-parent:last").find(".chapter-title-main").focus();
};


const save_chapter = (e) => {
    let target = $(e.currentTarget);
    let parent = target.closest(".chapter-parent");

    frappe.call({
        method: "lms.lms.doctype.lms_course.lms_course.save_chapter",
        args: {
            "course": $("#title").data("course"),
            "title": parent.find(".chapter-title-main").text(),
            "chapter_description": parent.find("#chapter-description").text(),
            "idx": target.data("index"),
            "chapter": target.data("chapter") ? target.data("chapter") : ""
        },
        callback: (data) => {
            window.location.reload();
        }
    });
};
