frappe.ready(() => {
	$(".clickable-row").click((e) => {
		window.location.href = $(e.currentTarget).data("href");
	});

	$(".btn-schedule-eval").click((e) => {
		open_evaluation_form(e);
	});

	$(document).on("click", ".slot", (e) => {
		mark_active_slot(e);
	});
});

const open_evaluation_form = (e) => {
	this.eval_form = new frappe.ui.Dialog({
		title: __("Schedule Evaluation"),
		fields: [
			{
				fieldtype: "Link",
				fieldname: "course",
				label: __("Course"),
				options: "LMS Course",
				reqd: 1,
				filters: {
					name: ["in", courses],
				},
				filter_description: " ",
			},
			{
				fieldtype: "Date",
				fieldname: "date",
				label: __("Date"),
				reqd: 1,
				min_date: new Date(
					frappe.datetime.add_days(frappe.datetime.get_today(), 1)
				),
				change: () => {
					get_slots();
				},
			},
			{
				fieldtype: "HTML",
				fieldname: "slots",
				label: __("Slots"),
			},
		],
		primary_action: (values) => {
			submit_evaluation_form(values);
		},
	});
	this.eval_form.show();
	setTimeout(() => {
		$(".modal-body").css("min-height", "300px");
	}, 1000);
};

const get_slots = () => {
	frappe.call({
		method: "lms.lms.doctype.course_evaluator.course_evaluator.get_schedule",
		args: {
			course: this.eval_form.get_value("course"),
			date: this.eval_form.get_value("date"),
			class_name: class_name,
		},
		callback: (r) => {
			if (r.message) {
				display_slots(r.message);
			}
		},
	});
};

const display_slots = (slots) => {
	let slot_html = "";
	let day = moment(this.eval_form.get_value("date")).format("dddd");

	slots.forEach((slot) => {
		if (slot.day == day) {
			slot_html += `<div class="btn btn-sm btn-default slot" data-day="${
				slot.day
			}"
				data-start="${slot.start_time}" data-end="${slot.end_time}">
				${moment(slot.start_time, "hh:mm").format("hh:mm a")} -
				${moment(slot.end_time, "hh:mm").format("hh:mm a")}
			</div>`;
		}
	});

	if (!slot_html) {
		slot_html = `<div class="alert alert-danger" role="alert">
			No slots available for this date.
		</div>`;
	}

	$("[data-fieldname='slots']").html(slot_html);
};

const mark_active_slot = (e) => {
	$(".slot").removeClass("btn-outline-primary");
	$(e.currentTarget).addClass("btn-outline-primary");
	this.current_slot = $(e.currentTarget);
};

const submit_evaluation_form = (values) => {
	if (!this.current_slot) {
		frappe.throw(__("Please select a slot"));
	}

	frappe.call({
		method: "lms.lms.doctype.lms_certificate_request.lms_certificate_request.create_certificate_request",
		args: {
			course: values.course,
			date: values.date,
			start_time: this.current_slot.data("start"),
			end_time: this.current_slot.data("end"),
			day: this.current_slot.data("day"),
			class_name: class_name,
		},
		callback: (r) => {
			this.eval_form.hide();
			frappe.show_alert({
				message: __("Evaluation scheduled successfully"),
				indicator: "green",
			});
			setTimeout(() => {
				window.location.reload();
			}, 1000);
		},
	});
};
