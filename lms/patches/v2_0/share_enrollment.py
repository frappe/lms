import frappe
from frappe.model.naming import make_autoname
from frappe.query_builder.functions import IfNull
from frappe.utils import now
from frappe.utils.synchronization import filelock

FIELDS = [
	"name",
	"creation",
	"modified",
	"modified_by",
	"owner",
	"user",
	"share_doctype",
	"share_name",
	"read",
	"write",
	"notify_by_email",
]


def execute():
	# Commit before releasing the lock, or a run waiting on it can read the shares
	# before this run's inserts are visible and add them a second time.
	with filelock("lms_share_enrollment"):
		share_missing_enrollments()
		frappe.db.commit()


def share_missing_enrollments():
	Enrollment = frappe.qb.DocType("LMS Enrollment")
	User = frappe.qb.DocType("User")

	enrollments = (
		frappe.qb.from_(Enrollment)
		.join(User)
		.on(User.name == Enrollment.member)
		.select(Enrollment.name, Enrollment.member)
		.where(IfNull(Enrollment.owner, "") != Enrollment.member)
		.run(as_dict=True)
	)

	shared = set(
		frappe.get_all(
			"DocShare",
			filters={"share_doctype": "LMS Enrollment"},
			fields=["share_name", "user"],
			as_list=True,
		)
	)

	timestamp = now()
	values = (
		[
			make_autoname("hash", "DocShare"),
			timestamp,
			timestamp,
			"Administrator",
			"Administrator",
			enrollment.member,
			"LMS Enrollment",
			enrollment.name,
			1,
			1,
			0,
		]
		for enrollment in enrollments
		if (enrollment.name, enrollment.member) not in shared
	)

	frappe.db.bulk_insert("DocShare", fields=FIELDS, values=values)
