import frappe
from frappe.utils import getdate, get_time_str, nowtime
from lms.lms.utils import (
	has_course_moderator_role,
	has_course_evaluator_role,
	check_multicurrency,
)
import json

def get_context(context):
	context.no_cache = 1
	context.is_moderator = has_course_moderator_role()
	context.is_evaluator = has_course_evaluator_role()
	batches = frappe.get_all(
		"LMS Batch",
		fields=[
			"name",
			"title",
			"description",
			"start_date",
			"end_date",
			"start_time",
			"end_time",
			"paid_batch",
			"amount",
			"currency",
			"seat_count",
			"published",
			"amount_usd",
		],
		order_by="start_date",
	)

	past_batches, upcoming_batches, private_batches = [], [], []
	for batch in batches:
		batch.student_count = frappe.db.count("Batch Student", {"parent": batch.name})
		batch.course_count = frappe.db.count("Batch Course", {"parent": batch.name})

		if batch.amount and batch.currency:
			amount, currency = check_multicurrency(
				batch.amount, batch.currency, None, batch.amount_usd
			)
			batch.amount = amount
			batch.currency = currency

		batch.seats_left = (
			batch.seat_count - batch.student_count if batch.seat_count else None
		)
		if not batch.published:
			private_batches.append(batch)
		elif getdate(batch.start_date) < getdate():
			past_batches.append(batch)
		elif (
			getdate(batch.start_date) == getdate() and get_time_str(batch.start_time) < nowtime()
		):
			past_batches.append(batch)
		else:
			upcoming_batches.append(batch)

	context.past_batches = sorted(past_batches, key=lambda d: d.start_date, reverse=True)
	context.upcoming_batches = sorted(upcoming_batches, key=lambda d: d.start_date)
	context.private_batches = sorted(private_batches, key=lambda d: d.start_date)
	get_filter = frappe.db.get_all('Filter Item',{'parent':'LMS Filters'},['*'])
	if get_filter:
		set_filter_model = {}
		for data in get_filter:
			if  'LMS Batch' in data['reference_doctype'].split(','):
				set_filter_model[data['name1']] = [data['custom_field']] + frappe.db.get_list(data['name1'], pluck='name')
		context.filters = set_filter_model
	if frappe.session.user != "Guest":
		my_batches_info = []
		my_batches = frappe.get_all(
			"Batch Student", {"student": frappe.session.user}, pluck="parent"
		)

		for batch in my_batches:
			batchinfo = frappe.db.get_value(
				"LMS Batch",
				batch,
				[
					"name",
					"title",
					"description",
					"start_date",
					"end_date",
					"paid_batch",
					"amount",
					"currency",
					"seat_count",
				],
				as_dict=True,
			)

			batchinfo.student_count = frappe.db.count(
				"Batch Student", {"parent": batchinfo.name}
			)
			batchinfo.course_count = frappe.db.count("Batch Course", {"parent": batchinfo.name})
			batchinfo.seats_left = batchinfo.seat_count - batchinfo.student_count

			my_batches_info.append(batchinfo)
			my_batches_info = sorted(my_batches_info, key=lambda d: d.start_date, reverse=True)

		context.my_batches = my_batches_info

@frappe.whitelist()
def filtered_data(filter):
	data = json.loads(filter)
	filters_data = {}
	for key, values in data.items():	
		if values:	
			filters_data[key] = ["in", values]

	batches = frappe.get_all(
		"LMS Batch",
		filters=filters_data,
		fields=[
			"name",
			"title",
			"description",
			"start_date",
			"end_date",
			"start_time",
			"end_time",
			"paid_batch",
			"amount",
			"currency",
			"seat_count",
			"published",
			"amount_usd",
		],
		order_by="start_date",
	)
	past_batches, upcoming_batches, private_batches = [], [], []
	for batch in batches:
		batch.student_count = frappe.db.count("Batch Student", {"parent": batch.name})
		batch.course_count = frappe.db.count("Batch Course", {"parent": batch.name})

		if batch.amount and batch.currency:
			amount, currency = check_multicurrency(
				batch.amount, batch.currency, None, batch.amount_usd
			)
			batch.amount = amount
			batch.currency = currency

		batch.seats_left = (
			batch.seat_count - batch.student_count if batch.seat_count else None
		)
		if not batch.published:
			private_batches.append(batch)
		elif getdate(batch.start_date) < getdate():
			past_batches.append(batch)
		elif (
			getdate(batch.start_date) == getdate() and get_time_str(batch.start_time) < nowtime()
		):
			past_batches.append(batch)
		else:
			upcoming_batches.append(batch)

	context_past_batches = sorted(past_batches, key=lambda d: d.start_date, reverse=True)
	context_upcoming_batches = sorted(upcoming_batches, key=lambda d: d.start_date)
	context_private_batches = sorted(private_batches, key=lambda d: d.start_date)
	if frappe.session.user != "Guest":
		my_batches_info = []
		my_batches = frappe.get_all(
			"Batch Student", {"student": frappe.session.user}, pluck="parent"
		)

		for batch in my_batches:
			batchinfo = frappe.db.get_value(
				"LMS Batch",
				batch,
				[
					"name",
					"title",
					"description",
					"start_date",
					"end_date",
					"paid_batch",
					"amount",
					"currency",
					"seat_count",
				],
				as_dict=True,
			)

			batchinfo.student_count = frappe.db.count(
				"Batch Student", {"parent": batchinfo.name}
			)
			batchinfo.course_count = frappe.db.count("Batch Course", {"parent": batchinfo.name})
			batchinfo.seats_left = batchinfo.seat_count - batchinfo.student_count

			my_batches_info.append(batchinfo)
			my_batches_info = sorted(my_batches_info, key=lambda d: d.start_date, reverse=True)

		context_my_batches = my_batches_info

	return context_upcoming_batches, context_past_batches, context_private_batches, context_my_batches

@frappe.whitelist()
def get_time(batch):
	return frappe.utils.format_time(batch, "HH:mm a")

@frappe.whitelist()
def is_student_(batch):
	from lms.www.utils import is_student
	return is_student(batch)