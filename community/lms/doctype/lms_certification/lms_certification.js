// Copyright (c) 2021, FOSS United and contributors
// For license information, please see license.txt

frappe.ui.form.on('LMS Certification', {
  onload: function (frm) {
    frm.set_query("student", function (doc) {
      return {
        filters: {
          "ignore_user_type": 1,
        }
      };
    });
  }
});
