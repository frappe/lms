// Copyright (c) 2021, FOSS United and contributors
// For license information, please see license.txt

frappe.ui.form.on("LMS Course", {
    onload: function (frm) {
        frm.set_query("chapter", "chapters", function () {
            return {
                filters: {
                    course: frm.doc.name,
                },
            };
        });

        frm.set_query("course", "related_courses", function () {
            return {
                filters: {
                    published: true,
                },
            };
        });
    },

    refresh: function (frm) {
        const lmsPath = frappe.boot.lms_path || "lms";

        frm.add_web_link(
            `/${lmsPath}/courses/${frm.doc.name}`,
            __("See on Website")
        );

        if (!frm.doc.currency) {
            frappe.db
                .get_single_value("LMS Settings", "default_currency")
                .then((value) => {
                    frm.set_value("currency", value);
                });
        }

        if (!frm.is_new()) {
            frm.add_custom_button(
                __("Exportar Curso"),
                function () {
                    window.open(
                        "/api/method/lms.lms.doctype.lms_course.lms_course.export_course"
                        + "?course_name=" + frm.doc.name
                    );
                },
                __("Actions")
            );
        }
    },
});
// ← listview_settings y show_import_dialog eliminados: viven en course_list.js