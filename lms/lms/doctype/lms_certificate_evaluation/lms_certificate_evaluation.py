# Copyright (c) 2022, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.query_builder import Bracket
from pypika.terms import LiteralValue

from lms.lms.utils import get_evaluator, has_moderator_role


class LMSCertificateEvaluation(Document):
	def validate(self):
		self.validate_rating()

	def validate_rating(self):
		if self.status not in ["Pending", "In Progress"] and self.rating == 0:
			frappe.throw(_("Rating cannot be 0"))


def has_website_permission(doc, ptype, user, verbose=False):
	if has_moderator_role() or doc.member == frappe.session.user:
		return True
	return False


def is_evaluation_admin(user=None):
	user = user or frappe.session.user
	return bool(has_moderator_role(user)) or "System Manager" in frappe.get_roles(user)


def has_permission(doc, ptype="read", user=None):
	"""The Batch Evaluator DocPerm grants CRUD on the whole doctype, so without
	this every evaluator could grade, retitle or delete any other evaluator's
	evaluations over the generic REST path. Returning False is what denies them.

	`has_website_permission` above only covers portal routes; the desk, reports,
	Data Import and /api/resource never consult it.
	"""
	user = user or frappe.session.user
	if is_evaluation_admin(user):
		return True

	if ptype in ("read", "select", "print"):
		return doc.evaluator == user or doc.member == user

	if ptype == "create":
		# The caller picks `evaluator` on a new row, so trusting that field alone
		# would let any evaluator mint a Pass for any member on any course. Ask the
		# same question save_evaluation_details asks: who is assigned to this
		# course/batch? Members never create their own evaluation -- they book an
		# LMS Certificate Request that an evaluator or Moderator converts.
		return doc.evaluator == user and get_evaluator(doc.course, doc.batch_name) == user

	if ptype in ("write", "delete"):
		return doc.evaluator == user

	return False


def get_permission_query_conditions(user=None):
	"""List-read counterpart of has_permission above: a hook is consulted on
	single-document reads but not on list queries, and this is the reverse, so
	registering one without the other leaves half the doctype open."""
	user = user or frappe.session.user
	if user == "Administrator":
		return ""

	if is_evaluation_admin(user):
		return ""

	evaluation = frappe.qb.DocType("LMS Certificate Evaluation")
	# LiteralValue around frappe.db.escape, not the bare string: pypika inlines a value
	# by doubling quotes alone, which leaves a backslash live on MariaDB. Bracket keeps
	# the OR together once the caller ANDs this onto the rest of the where clause.
	member = LiteralValue(frappe.db.escape(user))
	condition = Bracket((evaluation.evaluator == member) | (evaluation.member == member))
	return condition.get_sql(with_namespace=True, quote_char="`" if frappe.db.db_type == "mariadb" else '"')


@frappe.whitelist()
def create_lms_certificate(source_name: str, target_doc: dict = None):
	# The type hint alone only raises under frappe.flags.in_test; in production
	# typing_validations logs and lets the value through.
	if not isinstance(source_name, str):
		frappe.throw(_("Evaluation must be a string."))

	evaluator = frappe.db.get_value("LMS Certificate Evaluation", source_name, "evaluator")
	if not is_evaluation_admin() and evaluator != frappe.session.user:
		frappe.throw(
			_("You are not the assigned evaluator for this evaluation."),
			frappe.PermissionError,
		)

	doc = get_mapped_doc(
		"LMS Certificate Evaluation",
		source_name,
		{"LMS Certificate Evaluation": {"doctype": "LMS Certificate"}},
		target_doc,
	)
	return doc
