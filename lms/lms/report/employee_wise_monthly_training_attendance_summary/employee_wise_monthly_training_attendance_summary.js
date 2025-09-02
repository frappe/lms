// Copyright (c) 2025, Frappe and contributors
// For license information, please see license.txt

frappe.query_reports["Employee-wise Monthly Training Attendance Summary"] = {
	"filters": [
		{
        "fieldname": "month",
        "label": "Month",
        "fieldtype": "Data",
        "reqd": 0
    },
    {
        "fieldname": "employee_id",
        "label": "Employee ID",
        "fieldtype": "Data"
    },
    {
        "fieldname": "employee_name",
        "label": "Employee Name",
        "fieldtype": "Data"
    },
	{
		"fieldname": "department",
		"label": "Department",
		"fieldtype": "Data"
	}

	]
};
