frappe.ui.form.on('LMS Filters', {
    refresh: function(frm) {
        frappe.call({
            method: 'lms.lms.search_filter.get_link_field',
            callback: function(response) {
                console.log(response)
                frappe.meta.get_docfield('Filter Item', 'field', frm.doc.name1).options = (response.message).join('\n');      
                frm.refresh_field('department');
            }
        });
    }
});

frappe.ui.form.on('Filter Item', {
    field: function(frm, cdt, cdn){
        var field_value = locals[cdt][cdn].field;
        frappe.call({
            method: 'lms.lms.search_filter.get_data_option',
            args:{
                'data': field_value
            },
            callback: function(response) {
                frappe.model.set_value(cdt, cdn, 'name1', response.message[0]);
                frappe.model.set_value(cdt, cdn, 'reference_doctype', response.message[1]);
                frappe.model.set_value(cdt, cdn, 'custom_field', response.message[2]);
            }
        });
    }

})
