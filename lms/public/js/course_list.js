frappe.listview_settings['LMS Course'] = {
    onload: function (listview) {
        // Evitar duplicados
        if (listview.page.main.find('.import-zip-btn').length) return;

        // Añadir botón
        listview.page.add_button(__('Importar ZIP'), function () {
            show_import_dialog(listview);
        }, { btn_class: 'btn-default import-zip-btn' });
    }
};

function show_import_dialog(listview) {
    const dialog = new frappe.ui.Dialog({
        title: __('Importar Curso desde ZIP'),
        fields: [
            {
                label: __('Archivo ZIP'),
                fieldname: 'zip_file',
                fieldtype: 'Attach',
                options: { restrict_file_type: '.zip' }
            }
        ],
        size: 'small',
        primary_action_label: __('Importar'),
        primary_action(values) {
            if (!values.zip_file) {
                frappe.msgprint(__('Selecciona un archivo.'));
                return;
            }

            dialog.hide();
            frappe.call({
                method: 'lms.lms.doctype.lms_course.lms_course.import_course',
                args: { file_url: values.zip_file },
                freeze: true,
                freeze_message: __('Importando...'),
                callback: function (r) {
                    if (r.message) {
                        frappe.show_alert({ message: __('Importado: ') + r.message, indicator: 'green' });
                        listview.refresh();
                    }
                }
            });
        }
    });
    dialog.show();
}