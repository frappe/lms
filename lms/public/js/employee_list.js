frappe.listview_settings["Employee"] = {
	onload(listview) {
		listview.page.add_action_item("Assign to LMS Batch", function () {
			const selected = listview.get_checked_items().map((d) => d.name);

			if (!selected.length) {
				frappe.msgprint("Please select at least one Employee.");
				return;
			}

			let dialog = new frappe.ui.Dialog({
				title: "Select LMS Batch",
				fields: [
					{
						label: "LMS Batch",
						fieldname: "batch",
						fieldtype: "Link",
						options: "LMS Batch",
						reqd: 1,
					},
				],
				primary_action_label: "Assign",
				primary_action(values) {
					frappe.call({
						method: "lms.lms.api.employee_batch_assignment.bulk_assign_existing_employees",
						args: {
							employee_list: selected,
							batch_name: values.batch,
						},
						callback(r) {
							frappe.msgprint(
								`Assigned: ${r.message.assigned}<br>
								 Skipped (No User): ${r.message.skipped_no_user}<br>
								 Skipped (Already in Batch): ${r.message.skipped_existing}`
							);
							dialog.hide();
							listview.refresh();
						},
					});
				},
			});

			dialog.show();
		});
	},
};
