// Copyright (c) 2022, Frappe and contributors
// For license information, please see license.txt

frappe.ui.form.on("LMS Batch", {
	onload: function (frm) {
		frm.set_query("student", "students", function (doc) {
			return {
				filters: {
					ignore_user_type: 1,
				},
			};
		});

		frm.set_query("reference_doctype", "timetable", function () {
			let doctypes = ["Course Lesson", "LMS Quiz", "LMS Assignment"];
			return {
				filters: {
					name: ["in", doctypes],
				},
			};
		});

		frm.set_query("assessment_type", "assessment", function () {
			let doctypes = ["LMS Quiz", "LMS Assignment"];
			return {
				filters: {
					name: ["in", doctypes],
				},
			};
		});

		frm.set_query("reference_doctype", "timetable_legends", function () {
			let doctypes = ["Course Lesson", "LMS Quiz", "LMS Assignment"];
			return {
				filters: {
					name: ["in", doctypes],
				},
			};
		});

		if (frm.doc.timetable.length && !frm.doc.timetable_legends.length) {
			set_default_legends(frm);
		}
	},

	timetable_template: function (frm) {
		set_timetable(frm);
	},

	refresh: (frm) => {
		frm.add_web_link(
			`/lms/batches/details/${frm.doc.name}`,
			"See on website"
		);
	},
});

const set_timetable = (frm) => {
	if (frm.doc.timetable_template) {
		frm.clear_table("timetable");
		frm.refresh_fields();

		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "LMS Batch Timetable",
				parent: "LMS Timetable Template",
				fields: [
					"reference_doctype",
					"reference_docname",
					"day",
					"start_time",
					"end_time",
					"duration",
					"milestone",
				],
				filters: {
					parent: frm.doc.timetable_template,
					parenttype: "LMS Timetable Template",
				},
				order_by: "idx",
			},
			callback: (data) => {
				add_timetable_rows(frm, data.message);
			},
		});
	}
};

const add_timetable_rows = (frm, timetable) => {
	timetable.forEach((row) => {
		let child = frm.add_child("timetable");
		child.reference_doctype = row.reference_doctype;
		child.reference_docname = row.reference_docname;
		child.date = frappe.datetime.add_days(frm.doc.start_date, row.day - 1);
		child.start_time = row.start_time;
		child.end_time = row.end_time
			? row.end_time
			: row.duration
			? moment
					.utc(row.start_time, "HH:mm")
					.add(row.duration, "hour")
					.format("HH:mm")
			: null;
		child.duration = row.duration;
		child.milestone = row.milestone;
	});
	frm.refresh_field("timetable");

	set_legends(frm);
};

const set_legends = (frm) => {
	if (frm.doc.timetable_template) {
		frm.clear_table("timetable_legends");
		frm.refresh_fields();
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "LMS Timetable Legend",
				parent: "LMS Timetable Template",
				fields: ["reference_doctype", "label", "color"],
				filters: {
					parent: frm.doc.timetable_template,
					parenttype: "LMS Timetable Template",
				},
				order_by: "idx",
			},
			callback: (data) => {
				add_legend_rows(frm, data.message);
			},
		});
	}
};

const add_legend_rows = (frm, legends) => {
	legends.forEach((row) => {
		let child = frm.add_child("timetable_legends");
		child.reference_doctype = row.reference_doctype;
		child.label = row.label;
		child.color = row.color;
	});
	frm.refresh_field("timetable_legends");
	frm.save();
};

const set_default_legends = (frm) => {
	const data = [
		{
			reference_doctype: "Course Lesson",
			label: "Lesson",
			color: "#449CF0",
		},
		{
			reference_doctype: "LMS Quiz",
			label: "LMS Quiz",
			color: "#39E4A5",
		},
		{
			reference_doctype: "LMS Assignment",
			label: "LMS Assignment",
			color: "#ECAD4B",
		},
		{
			reference_doctype: "LMS Live Class",
			label: "LMS Live Class",
			color: "#bb8be8",
		},
	];

	data.forEach((detail) => {
		let child = frm.add_child("timetable_legends");
		child.reference_doctype = detail.reference_doctype;
		child.label = detail.label;
		child.color = detail.color;
	});
	frm.refresh_field("timetable_legends");
	frm.save();
};
