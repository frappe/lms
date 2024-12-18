// Copyright (c) 2024, suvaidyam and contributors
// For license information, please see license.txt

frappe.ui.form.on("Regional Training Centre", {
    refresh(frm) {
        apply_filter("state_name", "country_name", frm, frm.doc.country);
        apply_filter("district_name", "state_name", frm, frm.doc.state);
    },
    country_name(frm) {
        apply_filter("state_name", "country_name", frm, frm.doc.country);
    },
    state_name(frm) {
        apply_filter("district_name", "state_name", frm, frm.doc.state);
    },
    country_name(frm) {
        frm.set_value({
            "state_name": "",
            "district_name": "",
        })
    },
    state_name(frm) {
        frm.set_value({
            "district_name": "",
        })
    },
});
