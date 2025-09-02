// Copyright (c) 2025, Frappe and contributors
// For license information, please see license.txt

frappe.query_reports["Batch-wise Attendance Report"] = {
	"filters": [
	{
	"fieldname": "batch_id",
	"label": "Batch ID",
	"fieldtype": "Link",
	"options": "LMS Batch"
    },
    {
        "fieldname": "batch_name",
        "label": "Batch Name",
        "fieldtype": "Data"
    },
    {
        "fieldname": "status",
        "label": "Attendance Status",
        "fieldtype": "Select",
        "options": "\nPresent\nAbsent"
    },
    {
        "fieldname": "member_id",
        "label": "Member ID",
        "fieldtype": "Data"
    },
    {
        "fieldname": "member_name",
        "label": "Member Name",
        "fieldtype": "Data"
    },
    {
        "fieldname": "note",
        "label": "Custom Note",
        "fieldtype": "Data"
    }

	]
};
