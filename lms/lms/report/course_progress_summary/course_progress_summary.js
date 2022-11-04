// Copyright (c) 2016, FOSS United and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Course Progress Summary"] = {
	filters: [
		{
			fieldname: "course",
			label: __("Course"),
			fieldtype: "Link",
			options: "LMS Course",
			reqd: 1,
		},
	],
};
