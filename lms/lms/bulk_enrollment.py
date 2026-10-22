# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""Helpers shared by the bulk "Enroll Students" endpoints for courses and batches."""

import math
from collections.abc import Callable
from typing import Literal

import frappe
from frappe import _
from frappe.utils import cint, flt
from pypika.terms import ExistsCriterion

from lms.lms.permissions import can_author_batch, can_author_course

MAX_BULK_ENROLL_MEMBERS: int = 50

PaidKind = Literal["course", "certificate", "batch"]

ENROLL_TARGETS = {
	"LMS Course": ("LMS Enrollment", "course"),
	"LMS Batch": ("LMS Batch Enrollment", "batch"),
}
MAX_SEARCH_RESULTS: int = 20

PAYMENT_DETAIL_KEYS = {"amount", "currency", "source"}
SAVEPOINT = "bulk_enroll_member"


def _decode(value, label: str):
	if isinstance(value, str):
		try:
			return frappe.parse_json(value)
		except Exception:
			frappe.throw(_("{0} is not valid JSON. Send it as a JSON value and try again.").format(label))
	return value


def parse_members(members: list | str, limit: int | None = MAX_BULK_ENROLL_MEMBERS) -> list[str]:
	members = _decode(members, _("Members"))
	if not isinstance(members, list) or not all(isinstance(m, str) and m.strip() for m in members):
		frappe.throw(_("Members must be a list of user emails. Remove empty entries and try again."))

	seen, unique = set(), []
	for member in members:
		member = member.strip()
		if member.lower() not in seen:
			seen.add(member.lower())
			unique.append(member)

	if limit is not None and len(unique) > limit:
		frappe.throw(
			_("You can enroll at most {0} students at a time. Remove {1} and try again.").format(
				limit, len(unique) - limit
			)
		)
	return unique


def parse_payment_details(details: dict | str | None) -> frappe._dict | None:
	if details is None:
		return None
	details = _decode(details, _("Payment details"))
	if not isinstance(details, dict) or set(details) != PAYMENT_DETAIL_KEYS:
		frappe.throw(_("Payment details must have exactly amount, currency and source."))

	amount = details["amount"]
	if (
		isinstance(amount, bool)
		or not isinstance(amount, int | float)
		or not math.isfinite(amount)
		or amount < 0
	):
		frappe.throw(_("Payment amount must be a number that is zero or more."))
	for key, doctype in (("currency", "Currency"), ("source", "LMS Source")):
		value = details[key]
		if not isinstance(value, str) or not frappe.db.exists(doctype, value):
			frappe.throw(_("{0} {1} does not exist. Choose an existing {0}.").format(_(doctype), value))
	return frappe._dict(details)


def parse_linked_payments(linked: dict | str | None) -> dict[str, str]:
	if linked is None:
		return {}
	linked = _decode(linked, _("Linked payments"))
	if not isinstance(linked, dict) or not all(
		isinstance(member, str) and isinstance(payment, str) for member, payment in linked.items()
	):
		frappe.throw(_("Linked payments must map each user email to an LMS Payment name."))
	return linked


def can_enroll_others(doctype: str, docname: str) -> bool:
	if doctype == "LMS Course":
		return can_author_course(docname)
	if doctype == "LMS Batch":
		roles = frappe.get_roles()
		return "Moderator" in roles or "Batch Evaluator" in roles or can_author_batch(docname)
	return False


def can_record_payments(doctype: str, docname: str) -> bool:
	if doctype == "LMS Course":
		return can_author_course(docname)
	if doctype == "LMS Batch":
		return can_author_batch(docname)
	return False


def get_paid_kind(doctype: str, docname: str, purchased_certificate: bool = False) -> PaidKind | None:
	if doctype == "LMS Course":
		paid_course, paid_certificate = frappe.db.get_value(
			"LMS Course", docname, ["paid_course", "paid_certificate"]
		) or (0, 0)
		if paid_course:
			return "course"
		if purchased_certificate and paid_certificate:
			return "certificate"
		return None
	if doctype == "LMS Batch":
		return "batch" if frappe.db.get_value("LMS Batch", docname, "paid_batch") else None
	return None


def enroll_each(
	members: list[str], enroll_one: Callable[[str], str]
) -> tuple[dict[str, list[str]], list[dict]]:
	outcomes: dict[str, list[str]] = {}
	errors: list[dict] = []
	for member in members:
		messages = len(frappe.local.message_log)
		frappe.db.savepoint(SAVEPOINT)
		try:
			outcome = enroll_one(member)
		except Exception as e:
			frappe.db.rollback(save_point=SAVEPOINT)
			# The row's messages are its error below, not a message for the whole request.
			del frappe.local.message_log[messages:]
			errors.append({"member": member, "error": str(e)})
		else:
			frappe.db.release_savepoint(SAVEPOINT)
			outcomes.setdefault(outcome, []).append(member)
	return outcomes, errors


def require_user(member: str) -> str:
	user = frappe.db.get_value("User", member, ["name", "enabled"], as_dict=True)
	if not user:
		frappe.throw(_("No user found with the email {0}.").format(member), frappe.ValidationError)
	if not user.enabled:
		frappe.throw(_("User {0} is disabled.").format(user.name), frappe.ValidationError)
	return user.name


def resolve_payment(
	member: str,
	doctype: str,
	docname: str,
	for_certificate: bool,
	details: frappe._dict | None,
	linked: dict[str, str],
) -> str | None:
	payment = linked.get(member)
	if payment is None:
		payment = next((p for m, p in linked.items() if m.lower() == member.lower()), None)
	if payment is not None:
		validate_linked_payment(payment, member, doctype, docname, for_certificate)
		return payment
	if details is not None:
		return create_payment(member, doctype, docname, for_certificate, details)
	return None


def create_payment(
	member: str, doctype: str, docname: str, for_certificate: bool, details: frappe._dict
) -> str:
	payment = frappe.get_doc(
		{
			"doctype": "LMS Payment",
			"member": member,
			"billing_name": frappe.db.get_value("User", member, "full_name") or member,
			"amount": details.amount,
			"currency": details.currency,
			"source": details.source,
			"payment_for_document_type": doctype,
			"payment_for_document": docname,
			"payment_for_certificate": int(for_certificate),
			"payment_received": 1,
		}
	)
	# nosemgrep: lms-unjustified-ignore-permissions - the endpoint authorised the caller with can_record_payments; LMS Payment has no DocPerm for instructors
	payment.insert(ignore_permissions=True)
	return payment.name


def validate_linked_payment(
	payment: str, member: str, doctype: str, docname: str, for_certificate: bool
) -> None:
	row = frappe.db.get_value(
		"LMS Payment",
		payment,
		[
			"member",
			"payment_for_document_type",
			"payment_for_document",
			"payment_for_certificate",
			"payment_received",
		],
		as_dict=True,
	)
	matches = (
		row
		and row.member == member
		and row.payment_for_document_type == doctype
		and row.payment_for_document == docname
		and bool(row.payment_for_certificate) == bool(for_certificate)
		and row.payment_received
	)
	if not matches:
		frappe.throw(
			_(
				"Payment {0} cannot be linked to {1} for {2}. Link a received payment made by this user for this {3}."
			).format(payment, member, docname, _(doctype)),
			frappe.ValidationError,
		)
	for enrollment_doctype in ("LMS Enrollment", "LMS Batch Enrollment"):
		if frappe.db.exists(enrollment_doctype, {"payment": payment}):
			frappe.throw(
				_(
					"Payment {0} is already used by an enrollment. Link a payment that is not yet used."
				).format(payment),
				frappe.ValidationError,
			)


def require_enroll_target(doctype: str, docname: str) -> None:
	if doctype not in ENROLL_TARGETS or not frappe.db.exists(doctype, docname):
		frappe.throw(_("Invalid course or batch."))
	if not can_enroll_others(doctype, docname):
		frappe.throw(_("You cannot enroll students in this {0}.").format(_(doctype)), frappe.PermissionError)


def get_preview(doctype: str, docname: str, members: list[str], purchased_certificate: bool) -> dict:
	if not members:
		return {"rows": [], **get_target_summary(doctype, docname)}

	enrollment_doctype, link_field = ENROLL_TARGETS[doctype]
	is_course = doctype == "LMS Course"

	User = frappe.qb.DocType("User")
	users = {
		row.name.lower(): row
		for row in frappe.qb.from_(User)
		.select(User.name, User.enabled, User.full_name, User.user_image)
		.where(User.name.isin(members))
		.run(as_dict=True)
	}

	Enrollment = frappe.qb.DocType(enrollment_doctype)
	enrollment_fields = [Enrollment.member] + ([Enrollment.purchased_certificate] if is_course else [])
	enrolled = {
		row.member.lower(): row
		for row in frappe.qb.from_(Enrollment)
		.select(*enrollment_fields)
		.where(Enrollment[link_field] == docname)
		.where(Enrollment.member.isin(members))
		.run(as_dict=True)
	}

	rows = []
	for member in members:
		user = users.get(member.lower())
		enrollment = enrolled.get(member.lower())
		rows.append(
			{
				"member": member,
				"full_name": user.full_name if user else None,
				"user_image": user.user_image if user else None,
				"status": _preview_status(user, enrollment, is_course and purchased_certificate),
				"linkable_payments": [],
			}
		)

	attach_linkable_payments(doctype, docname, purchased_certificate, rows, users)
	return {"rows": rows, **get_target_summary(doctype, docname)}


def _preview_status(user, enrollment, upgrading: bool) -> str:
	if not user:
		return "no_user"
	if not user.enabled:
		return "disabled"
	if not enrollment:
		return "ready"
	if upgrading:
		return "certificate_purchased" if enrollment.purchased_certificate else "upgrade"
	return "enrolled"


def attach_linkable_payments(
	doctype: str, docname: str, purchased_certificate: bool, rows: list[dict], users: dict
) -> None:
	kind = get_paid_kind(doctype, docname, purchased_certificate)
	if not kind or not can_record_payments(doctype, docname):
		return
	candidates = [r for r in rows if r["status"] in ("ready", "upgrade")]
	if not candidates:
		return

	enrollment_doctype, link_field = ENROLL_TARGETS[doctype]
	Payment = frappe.qb.DocType("LMS Payment")
	Enrollment = frappe.qb.DocType(enrollment_doctype)
	used = (
		frappe.qb.from_(Enrollment)
		.select(Enrollment.payment)
		.where(Enrollment[link_field] == docname)
		.where(Enrollment.payment != "")
	)
	payments = (
		frappe.qb.from_(Payment)
		.select(Payment.name, Payment.member, Payment.amount, Payment.currency, Payment.creation)
		.where(Payment.member.isin([users[r["member"].lower()].name for r in candidates]))
		.where(Payment.payment_for_document_type == doctype)
		.where(Payment.payment_for_document == docname)
		.where(Payment.payment_for_certificate == int(kind == "certificate"))
		.where(Payment.payment_received == 1)
		.where(Payment.name.notin(used))
		.orderby(Payment.creation, order=frappe.qb.desc)
		.run(as_dict=True)
	)
	by_member: dict[str, list[dict]] = {}
	for payment in payments:
		by_member.setdefault(payment.member.lower(), []).append(
			{key: payment[key] for key in ("name", "amount", "currency", "creation")}
		)
	for row in candidates:
		row["linkable_payments"] = by_member.get(row["member"].lower(), [])


def get_target_summary(doctype: str, docname: str) -> dict:
	if doctype == "LMS Course":
		price, currency = frappe.db.get_value("LMS Course", docname, ["course_price", "currency"])
		return {"seats_left": None, "amount": flt(price), "currency": currency}

	amount, currency, seat_count = frappe.db.get_value(
		"LMS Batch", docname, ["amount", "currency", "seat_count"]
	)
	seats_left = None
	if seat_count:
		seats_left = cint(seat_count) - frappe.db.count("LMS Batch Enrollment", {"batch": docname})
	return {"seats_left": seats_left, "amount": flt(amount), "currency": currency}


def search_users(
	doctype: str, docname: str, txt: str, include_enrolled: bool, page_length: int, names: list[str] | None
) -> list[dict]:
	if names is not None and not names:
		return []

	User = frappe.qb.DocType("User")
	query = (
		frappe.qb.from_(User)
		.select(User.name, User.full_name)
		.where(User.enabled == 1)
		.where(User.name.notin(("Administrator", "Guest")))
	)
	if not {"Moderator", "System Manager"} & set(frappe.get_roles()):
		query = query.where(User.user_type != "System User")
	if names is not None:
		query = query.where(User.name.isin(names)).orderby(User.name)
	else:
		if txt:
			query = query.where(User.full_name.like(f"%{txt}%") | User.name.like(f"%{txt}%"))
		if not include_enrolled:
			enrollment_doctype, link_field = ENROLL_TARGETS[doctype]
			Enrollment = frappe.qb.DocType(enrollment_doctype)
			enrolled = (
				frappe.qb.from_(Enrollment)
				.select(1)
				.where(Enrollment[link_field] == docname)
				.where(Enrollment.member == User.name)
			)
			query = query.where(~ExistsCriterion(enrolled))
		query = query.orderby(User.full_name).orderby(User.name).limit(min(page_length, MAX_SEARCH_RESULTS))
	return [
		{"value": user.name, "label": user.full_name or user.name, "description": user.name}
		for user in query.run(as_dict=True)
	]
