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

REQUIRED_DETAIL_KEYS = {"amount", "currency"}
PAYMENT_DETAIL_KEYS = REQUIRED_DETAIL_KEYS | {"source"}
MEMBER_DETAIL_KEYS = PAYMENT_DETAIL_KEYS | {"billing_name"}
ADDRESS_KEYS = {"address_line1", "address_line2", "city", "state", "country", "pincode", "phone"}
REQUIRED_ADDRESS_KEYS = ("address_line1", "city", "country")
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


def _check_amount(amount) -> None:
	if (
		isinstance(amount, bool)
		or not isinstance(amount, int | float)
		or not math.isfinite(amount)
		or amount < 0
	):
		frappe.throw(_("Payment amount must be a number that is zero or more."))


def _check_exists(doctype: str, value) -> None:
	if not isinstance(value, str) or not frappe.db.exists(doctype, value):
		frappe.throw(_("{0} {1} does not exist. Choose an existing {0}.").format(_(doctype), value))


def _field_label(key: str) -> str:
	return {
		"currency": _("Currency"),
		"source": _("Source"),
		"billing_name": _("Billing Name"),
		"address_line1": _("Address Line 1"),
		"city": _("City"),
		"country": _("Country"),
	}[key]


def _parse_address(address, owner: str) -> dict[str, str] | str:
	"""An Address name links that address; an object creates one, and an empty object means none."""
	if isinstance(address, str):
		name = address.strip()
		if (
			not name
			or not frappe.db.exists("Address", name)
			or not frappe.has_permission("Address", "read", doc=name)
		):
			frappe.throw(
				_("{0} names an address that does not exist. Choose an existing address.").format(owner)
			)
		return name
	if not isinstance(address, dict) or not set(address) <= ADDRESS_KEYS:
		frappe.throw(
			_("Address must be an Address name or an object with only these keys: {0}.").format(
				", ".join(sorted(ADDRESS_KEYS))
			)
		)
	if not all(isinstance(value, str) for value in address.values()):
		frappe.throw(_("Every address value must be text."))
	address = {key: value.strip() for key, value in address.items() if value.strip()}
	missing = [_field_label(key) for key in REQUIRED_ADDRESS_KEYS if address and key not in address]
	if missing:
		frappe.throw(
			_("{0} is missing {1}. Fill these in, or clear the address to record none.").format(
				owner, ", ".join(missing)
			)
		)
	if "country" in address:
		_check_exists("Country", address["country"])
	return address


def parse_payment_details(details: dict | str | None) -> frappe._dict | None:
	if details is None:
		return None
	details = _decode(details, _("Payment details"))
	keys = set(details) if isinstance(details, dict) else set()
	if not isinstance(details, dict) or not REQUIRED_DETAIL_KEYS <= keys <= PAYMENT_DETAIL_KEYS | {"address"}:
		frappe.throw(_("Payment details must have amount and currency, and may add source and address."))

	_check_amount(details["amount"])
	_check_exists("Currency", details["currency"])
	source = details.get("source") or None
	if source:
		_check_exists("LMS Source", source)
	address = _parse_address(details["address"], _("The common address")) if "address" in details else {}
	return frappe._dict(
		amount=details["amount"], currency=details["currency"], source=source, address=address
	)


def parse_member_payment_details(
	details: dict | str | None, members: list[str], linked: dict[str, str] | None = None
) -> dict[str, dict]:
	if details is None:
		return {}
	details = _decode(details, _("Member payment details"))
	if not isinstance(details, dict) or not all(isinstance(m, str) for m in details):
		frappe.throw(_("Member payment details must map each user email to an object."))
	if len(details) > MAX_BULK_ENROLL_MEMBERS:
		frappe.throw(
			_("Member payment details can cover at most {0} students.").format(MAX_BULK_ENROLL_MEMBERS)
		)

	known = {m.lower() for m in members}
	linked_members = {m.lower() for m in linked or {}}
	parsed = {}
	for member, values in details.items():
		if member.lower() not in known:
			frappe.throw(_("Member payment details name {0}, who is not in the members list.").format(member))
		if member.lower() in parsed:
			frappe.throw(_("Member payment details name {0} more than once.").format(member))
		if member.lower() in linked_members:
			frappe.throw(
				_("{0} has a linked payment, so their payment details cannot be changed.").format(member)
			)
		parsed[member.lower()] = _parse_member_values(member, values)
	return parsed


def _parse_member_values(member: str, values) -> dict:
	if not isinstance(values, dict) or not set(values) <= MEMBER_DETAIL_KEYS | {"address"}:
		frappe.throw(
			_("Payment details for {0} must be an object with only these keys: {1}.").format(
				member, ", ".join(sorted(MEMBER_DETAIL_KEYS | {"address"}))
			)
		)
	clean = {key: value for key, value in values.items() if key != "address"}
	if "amount" in clean:
		_check_amount(clean["amount"])
	if clean.get("source") is None:
		clean.pop("source", None)
	for key in ("currency", "source", "billing_name"):
		if key not in clean:
			continue
		if not isinstance(clean[key], str):
			frappe.throw(_("{0} for {1} must be text.").format(_field_label(key), member))
		if key == "source" and not clean[key].strip():
			del clean[key]
			continue
		if not clean[key].strip():
			frappe.throw(_("{0} for {1} cannot be empty.").format(_field_label(key), member))
	if "currency" in clean:
		_check_exists("Currency", clean["currency"])
	if "source" in clean:
		_check_exists("LMS Source", clean["source"])
	if "address" in values:
		clean["address"] = _parse_address(values["address"], _("The address for {0}").format(member))
	return clean


def parse_payment_args(
	payment_details, linked_payments, member_payment_details, members: list[str]
) -> tuple[frappe._dict | None, dict[str, str], dict[str, dict]]:
	details = parse_payment_details(payment_details)
	linked = parse_linked_payments(linked_payments)
	if member_payment_details is not None and details is None:
		frappe.throw(_("Per-student payment details need the common payment details too."))
	return details, linked, parse_member_payment_details(member_payment_details, members, linked)


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


def require_user(member: str) -> frappe._dict:
	user = frappe.db.get_value("User", member, ["name", "enabled", "full_name"], as_dict=True)
	if not user:
		frappe.throw(_("No user found with the email {0}.").format(member), frappe.ValidationError)
	if not user.enabled:
		frappe.throw(_("User {0} is disabled.").format(user.name), frappe.ValidationError)
	return user


def resolve_payment(
	user: frappe._dict,
	doctype: str,
	docname: str,
	for_certificate: bool,
	details: frappe._dict | None,
	linked: dict[str, str],
	member_details: dict[str, dict] | None = None,
) -> str | None:
	member = user.name
	payment = linked.get(member)
	if payment is None:
		payment = next((p for m, p in linked.items() if m.lower() == member.lower()), None)
	if payment is not None:
		validate_linked_payment(payment, member, doctype, docname, for_certificate)
		return payment
	if details is not None:
		override = (member_details or {}).get(member.lower())
		return create_payment(user, doctype, docname, for_certificate, details, override)
	return None


def create_payment(
	user: frappe._dict,
	doctype: str,
	docname: str,
	for_certificate: bool,
	details: frappe._dict,
	override: dict | None = None,
) -> str:
	member = user.name
	override = override or {}
	values = {key: override.get(key, details.get(key)) for key in ("amount", "currency", "source")}
	billing_name = override.get("billing_name", "").strip() or user.full_name or member
	address = override["address"] if "address" in override else details.get("address", {})
	if isinstance(address, dict):
		address = create_billing_address(member, billing_name, address) if address else None

	payment = frappe.get_doc(
		{
			"doctype": "LMS Payment",
			"member": member,
			"billing_name": billing_name,
			**values,
			"payment_for_document_type": doctype,
			"payment_for_document": docname,
			"payment_for_certificate": int(for_certificate),
			"payment_received": 1,
			"address": address,
		}
	)
	payment.flags.recorded_by_staff = True
	# nosemgrep: lms-unjustified-ignore-permissions - the endpoint authorised the caller with can_record_payments; LMS Payment has no DocPerm for instructors
	payment.insert(ignore_permissions=True)
	return payment.name


def create_billing_address(member: str, billing_name: str, address: dict[str, str]) -> str:
	doc = frappe.get_doc(
		{
			"doctype": "Address",
			"address_type": "Billing",
			"address_title": billing_name,
			"email_id": member,
			**address,
			"links": [{"link_doctype": "User", "link_name": member}],
		}
	)
	# nosemgrep: lms-unjustified-ignore-permissions - the endpoint authorised the caller with can_record_payments; instructors have no Address DocPerm
	doc.insert(ignore_permissions=True)
	return doc.name


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
		.select(User.name, User.full_name, User.user_image)
		.where(User.enabled == 1)
		.where(User.name.notin(("Administrator", "Guest")))
	)
	if not {"Moderator", "System Manager"} & set(frappe.get_roles()):
		query = query.where(User.user_type != "System User")
	query = query.where(~ExistsCriterion(_blocking_enrollment(doctype, docname, include_enrolled)))
	if names is not None:
		query = query.where(User.name.isin(names)).orderby(User.name)
	else:
		if txt:
			query = query.where(User.full_name.like(f"%{txt}%") | User.name.like(f"%{txt}%"))
		query = query.orderby(User.full_name).orderby(User.name).limit(min(page_length, MAX_SEARCH_RESULTS))
	return [
		{
			"value": user.name,
			"label": user.full_name or user.name,
			"description": user.name,
			"image": user.user_image,
		}
		for user in query.run(as_dict=True)
	]


def _blocking_enrollment(doctype: str, docname: str, include_enrolled: bool):
	enrollment_doctype, link_field = ENROLL_TARGETS[doctype]
	Enrollment = frappe.qb.DocType(enrollment_doctype)
	User = frappe.qb.DocType("User")
	blocking = (
		frappe.qb.from_(Enrollment)
		.select(1)
		.where(Enrollment[link_field] == docname)
		.where(Enrollment.member == User.name)
	)
	if include_enrolled and doctype == "LMS Course":
		blocking = blocking.where(Enrollment.purchased_certificate == 1)
	return blocking
