// Copyright (c) 2025, Frappe and contributors
// For license information, please see license.txt

frappe.query_reports["Training-wise Participation Report"] = {
	"filters": [
	{
      "fieldname": "course",
      "label": "Training Title / ID",
      "fieldtype": "Link",
      "options": "Course"
    },
    {
      "fieldname": "trainer",
      "label": "Trainer",
      "fieldtype": "Link",
      "options": "Instructor"
    },
    {
      "fieldname": "from_date",
      "label": "From Date",
      "fieldtype": "Date"
    },
    {
      "fieldname": "to_date",
      "label": "To Date",
      "fieldtype": "Date"
    }

	]
};
