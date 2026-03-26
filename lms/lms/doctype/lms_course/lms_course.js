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

        // Botón Exportar
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

// Vista de Lista - Botón Importar
frappe.listview_settings["LMS Course"] = {
    onload: function (listview) {
        // Añadir botón directamente en la barra
        listview.page.add_button(
            __("Importar ZIP"),
            function () {
                show_import_dialog(listview);
            },
            { btn_class: "btn-default" }
        );
    },
};

function show_import_dialog(listview) {
    const dialog = new frappe.ui.Dialog({
        title: __("Importar Curso desde ZIP"),
        fields: [
            {
                label: __("Archivo ZIP"),
                fieldname: "zip_file",
                fieldtype: "Attach",
                reqd: 1,
                description: __("Sube el archivo .zip exportado previamente."),
            },
        ],
        size: "small",
        primary_action_label: __("Importar"),

        primary_action: function () {
            const file_url = dialog.get_value("zip_file");

            if (!file_url) {
                frappe.msgprint({
                    title: __("Archivo requerido"),
                    message: __("Por favor sube un archivo ZIP."),
                    indicator: "orange",
                });
                return;
            }

            dialog.set_primary_action_loading(true);

            frappe.call({
                method: "lms.lms.doctype.lms_course.lms_course.import_course",
                args: { file_url: file_url },
                freeze: true,
                freeze_message: __("Importando curso..."),
                callback: function (r) {
                    dialog.set_primary_action_loading(false);
                    if (r.message) {
                        dialog.hide();
                        frappe.show_alert(
                            {
                                message: __("Curso importado: {0}", [r.message]),
                                indicator: "green",
                            },
                            7
                        );
                        listview.refresh();
                    }
                },
                error: function () {
                    dialog.set_primary_action_loading(false);
                },
            });
        },
    });

    dialog.show();
}