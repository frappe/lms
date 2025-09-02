// Copyright (c) 2025, Frappe and contributors
// For license information, please see license.txt

frappe.query_reports["All Batch Attendance Report"] = {
	"filters": [
	{
        "fieldname": "from_date",
        "label": "From Date",
        "fieldtype": "Date"
    },
    {
        "fieldname": "to_date",
        "label": "To Date",
        "fieldtype": "Date"
    },
    {
        "fieldname": "category",
        "label": "Category",
        "fieldtype": "Data"
    },
    {
        "fieldname": "published",
        "label": "Published",
        "fieldtype": "Check"
    },
    {
        "fieldname": "certification",
        "label": "Certification",
        "fieldtype": "Check"
    }

	]
};
