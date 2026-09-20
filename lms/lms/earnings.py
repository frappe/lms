import re

import frappe
from frappe import _
from frappe.utils import add_days, flt, getdate, now, nowdate


PLATFORM_COMMISSION_PERCENT = 20
PAYOUT_HOLD_DAYS = 14


def record_instructor_earnings(payment_name: str, bank_fee: float = 0):
	payment = frappe.db.get_value(
		"LMS Payment",
		payment_name,
		["name", "member", "payment_for_document_type", "payment_for_document", "amount", "amount_with_gst", "currency", "payment_received"],
		as_dict=True,
	)
	if not payment or not payment.payment_received:
		return
	gross = flt(payment.amount_with_gst or payment.amount, 2)
	if gross <= 0:
		return
	instructors = frappe.get_all(
		"Course Instructor",
		filters={"parenttype": payment.payment_for_document_type, "parent": payment.payment_for_document},
		pluck="instructor",
	)
	instructors = list(dict.fromkeys(filter(None, instructors)))
	if not instructors:
		frappe.log_error("No instructor found for paid course", payment.payment_for_document)
		return

	share_gross = flt(gross / len(instructors), 2)
	share_fee = flt(flt(bank_fee, 2) / len(instructors), 2)
	for instructor in instructors:
		if frappe.db.exists("LMS Instructor Earning", {"payment": payment.name, "instructor": instructor}):
			continue
		net = max(share_gross - share_fee, 0)
		platform = flt(net * PLATFORM_COMMISSION_PERCENT / 100, 2)
		frappe.get_doc(
			{
				"doctype": "LMS Instructor Earning",
				"instructor": instructor,
				"payment": payment.name,
				"payment_type": payment.payment_for_document_type,
				"course": payment.payment_for_document,
				"student": payment.member,
				"status": "Pending",
				"available_on": add_days(nowdate(), PAYOUT_HOLD_DAYS),
				"gross_amount": share_gross,
				"bank_fee": share_fee,
				"platform_commission": platform,
				"instructor_amount": flt(net - platform, 2),
				"currency": payment.currency,
			}
		).insert(ignore_permissions=True)


def _is_manager():
	roles = frappe.get_roles()
	return "System Manager" in roles or "Moderator" in roles


@frappe.whitelist()
def get_earnings_dashboard():
	user = frappe.session.user
	if user == "Guest":
		frappe.throw(_("Please log in."), frappe.PermissionError)
	manager = _is_manager()
	filters = {} if manager else {"instructor": user}
	rows = frappe.get_all(
		"LMS Instructor Earning",
		filters=filters,
		fields=["name", "instructor", "course", "student", "status", "available_on", "gross_amount", "bank_fee", "platform_commission", "instructor_amount", "currency", "payout", "creation"],
		order_by="creation desc",
		limit_page_length=200,
	)
	today = getdate(nowdate())
	for row in rows:
		if row.status == "Pending" and getdate(row.available_on) <= today:
			row.status = "Available"
	stats = {"pending": 0, "available": 0, "requested": 0, "paid": 0}
	for row in rows:
		key = row.status.lower()
		if key in stats:
			stats[key] = flt(stats[key] + row.instructor_amount, 2)
	profile = frappe.db.get_value("LMS Instructor Payment Profile", user, ["account_name", "iin_bin", "iban", "verified"], as_dict=True)
	payouts = frappe.get_all(
		"LMS Instructor Payout",
		filters={} if manager else {"instructor": user},
		fields=["name", "instructor", "amount", "currency", "status", "requested_on", "processed_on", "bank_reference"],
		order_by="creation desc",
		limit_page_length=100,
	)
	return {"stats": stats, "earnings": rows, "payouts": payouts, "profile": profile, "is_manager": manager, "commission_percent": PLATFORM_COMMISSION_PERCENT, "hold_days": PAYOUT_HOLD_DAYS}


@frappe.whitelist()
def save_payment_profile(account_name: str, iin_bin: str, iban: str):
	user = frappe.session.user
	iban = re.sub(r"\s+", "", iban or "").upper()
	iin_bin = re.sub(r"\D", "", iin_bin or "")
	if not re.fullmatch(r"KZ[0-9A-Z]{18}", iban):
		frappe.throw(_("Enter a valid Kazakhstan IBAN (KZ followed by 18 characters)."))
	if len(iin_bin) != 12:
		frappe.throw(_("IIN / BIN must contain 12 digits."))
	doc = frappe.get_doc("LMS Instructor Payment Profile", user) if frappe.db.exists("LMS Instructor Payment Profile", user) else frappe.new_doc("LMS Instructor Payment Profile")
	doc.update({"instructor": user, "account_name": account_name.strip(), "iin_bin": iin_bin, "iban": iban, "verified": 0})
	doc.save(ignore_permissions=True)
	return {"ok": True}


@frappe.whitelist()
def request_payout():
	user = frappe.session.user
	if not frappe.db.exists("LMS Instructor Payment Profile", user):
		frappe.throw(_("Add your payment details before requesting a payout."))
	rows = frappe.get_all("LMS Instructor Earning", filters={"instructor": user, "status": "Pending", "available_on": ["<=", nowdate()], "payout": ["is", "not set"]}, fields=["name", "instructor_amount", "currency"])
	if not rows:
		frappe.throw(_("There are no earnings available for payout yet."))
	currencies = {row.currency for row in rows}
	if len(currencies) != 1:
		frappe.throw(_("Request payouts for one currency at a time."))
	payout = frappe.get_doc({"doctype": "LMS Instructor Payout", "instructor": user, "amount": flt(sum(row.instructor_amount for row in rows), 2), "currency": currencies.pop(), "status": "Requested", "requested_on": now()}).insert(ignore_permissions=True)
	for row in rows:
		frappe.db.set_value("LMS Instructor Earning", row.name, {"status": "Requested", "payout": payout.name})
	return payout.name


@frappe.whitelist()
def mark_payout_paid(payout: str, bank_reference: str):
	if not _is_manager():
		frappe.throw(_("Only an administrator can complete payouts."), frappe.PermissionError)
	if not bank_reference.strip():
		frappe.throw(_("Enter the bank transfer reference."))
	doc = frappe.get_doc("LMS Instructor Payout", payout)
	if doc.status != "Requested":
		frappe.throw(_("This payout is not awaiting payment."))
	doc.update({"status": "Paid", "processed_on": now(), "bank_reference": bank_reference.strip()})
	doc.save(ignore_permissions=True)
	frappe.db.set_value("LMS Instructor Earning", {"payout": doc.name}, "status", "Paid", update_modified=False)
	return {"ok": True}
