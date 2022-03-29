// Copyright (c) 2022, Frappe and contributors
// For license information, please see license.txt

frappe.ui.form.on('LMS Certificate Evaluation', {
    onload: function(frm) {
        frm.set_query("course", function(doc) {
            return {
                filters: {
                    "enable_certification": true,
                    "grant_certificate_after": "Evaluation"
                }
            };
        });

        frm.set_query("member", function(doc) {
            return {
                filters: {
                    "course": doc.course,
                }
            };
        });
    }
});
