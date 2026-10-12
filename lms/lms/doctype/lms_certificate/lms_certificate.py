# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.email.doctype.email_template.email_template import get_email_template
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe.utils import nowdate
from frappe.utils.telemetry import capture
from pypika import Case

from lms.lms.permissions import is_site_administrator
from lms.lms.utils import get_evaluator


class LMSCertificate(Document):
	def validate(self):
		self.validate_criteria()
		self.validate_duplicate_certificate()

	def autoname(self):
		self.name = make_autoname("hash", self.doctype)

	def after_insert(self):
		capture("certificate_issued", "lms")
		self.send_certification_email()

	def send_certification_email(self):
		outgoing_email_account = frappe.get_cached_value(
			"Email Account", {"default_outgoing": 1, "enable_outgoing": 1}, "name"
		)
		if outgoing_email_account or frappe.conf.get("mail_login"):
			self.send_mail()

	def send_mail(self):
		subject = _("Congratulations on getting certified!")
		template = "certification"
		custom_template = frappe.db.get_single_value("LMS Settings", "certification_template")

		args = {
			"member_name": self.member_name,
			"course_name": self.course,
			"course_title": frappe.db.get_value("LMS Course", self.course, "title"),
			"name": self.name,
			"template": self.template,
		}

		if custom_template:
			email_template = get_email_template(custom_template, args)
			subject = email_template.get("subject")
			content = email_template.get("message")
		frappe.sendmail(
			recipients=self.member,
			subject=subject,
			template=template if not custom_template else None,
			content=content if custom_template else None,
			args=args,
			header=[subject, "green"],
		)

	def validate_criteria(self):
		self.validate_role_of_owner()
		if self.batch_name:
			self.validate_batch_enrollment()
		elif self.course:
			self.validate_course_enrollment()

	def validate_role_of_owner(self):
		roles = frappe.get_roles()
		is_admin = any(role in roles for role in ["Moderator", "Course Creator", "Batch Evaluator"])
		if not self.course and not self.batch_name and not is_admin:
			frappe.throw(_("Course or Batch is required to issue a certificate."))

	def validate_batch_enrollment(self):
		if self.batch_name:
			is_enrolled = frappe.db.exists(
				"LMS Batch Enrollment", {"batch": self.batch_name, "member": self.member}
			)
			if not is_enrolled:
				frappe.throw(_("Certification cannot be issued as the member is not enrolled in this batch."))

	def validate_course_enrollment(self):
		if self.course:
			is_enrolled = frappe.db.exists("LMS Enrollment", {"course": self.course, "member": self.member})
			if not is_enrolled:
				frappe.throw(
					_("Certification cannot be issued as the member is not enrolled in this course.")
				)

			completion_certificate = frappe.db.get_value("LMS Course", self.course, "enable_certification")
			if completion_certificate:
				progress = frappe.db.get_value(
					"LMS Enrollment", {"course": self.course, "member": self.member}, "progress"
				)
				if progress < 100:
					frappe.throw(
						_("Certification cannot be issued as the member has not completed the course.")
					)

	def validate_duplicate_certificate(self):
		self.validate_course_duplicates()
		self.validate_batch_duplicates()

	def validate_course_duplicates(self):
		if self.course:
			course_duplicates = frappe.get_all(
				"LMS Certificate",
				filters={
					"member": self.member,
					"name": ["!=", self.name],
					"course": self.course,
					# A member may hold one certificate per batch of the same course.
					"batch_name": self.batch_name or ["is", "not set"],
				},
				fields=["name", "course", "course_title"],
			)
			if len(course_duplicates):
				full_name = frappe.db.get_value("User", self.member, "full_name")
				frappe.throw(
					_("{0} is already certified for the course {1}").format(
						full_name, course_duplicates[0].course_title
					)
				)

	def validate_batch_duplicates(self):
		if self.batch_name:
			batch_duplicates = frappe.get_all(
				"LMS Certificate",
				filters={
					"member": self.member,
					"name": ["!=", self.name],
					"batch_name": self.batch_name,
				},
				fields=["name", "batch_name", "batch_title"],
			)
			if len(batch_duplicates):
				full_name = frappe.db.get_value("User", self.member, "full_name")
				frappe.throw(
					_("{0} is already certified for the batch {1}").format(
						full_name, batch_duplicates[0].batch_title
					)
				)

	def on_update(self):
		frappe.share.add_docshare(
			self.doctype,
			self.name,
			self.member,
			write=1,
			share=1,
			flags={"ignore_share_permission": True},
		)


def has_website_permission(doc, ptype, user, verbose=False):
	if ptype in ["read", "print"] and doc.published:
		return True
	if doc.member == user and ptype == "create":
		return True
	return False


def get_latest_certificate(member, course):
	"""A member can hold one certificate per batch of a course plus one
	course-level (no batch) certificate; prefer the course-level one, else
	the most recently issued."""
	Certificate = frappe.qb.DocType("LMS Certificate")
	no_batch = Certificate.batch_name.isnull() | (Certificate.batch_name == "")
	has_batch = Case().when(no_batch, 0).else_(1)
	rows = (
		frappe.qb.from_(Certificate)
		.select(Certificate.name, Certificate.template, Certificate.issue_date)
		.where(Certificate.member == member)
		.where(Certificate.course == course)
		.orderby(has_batch)
		.orderby(Certificate.issue_date, order=frappe.qb.desc)
		.orderby(Certificate.creation, order=frappe.qb.desc)
		.limit(1)
		.run(as_dict=True)
	)
	return rows[0] if rows else None


def is_certified(course):
	certificate = get_latest_certificate(frappe.session.user, course)
	return certificate.name if certificate else None


@frappe.whitelist()
def create_certificate(course: str):
	certificate = is_certified(course)
	if certificate:
		return frappe.db.get_value(
			"LMS Certificate", certificate, ["name", "course", "template"], as_dict=True
		)

	else:
		validate_certification_eligibility(course)
		default_certificate_template = get_default_certificate_template()
		certificate = frappe.get_doc(
			{
				"doctype": "LMS Certificate",
				"member": frappe.session.user,
				"course": course,
				"issue_date": nowdate(),
				"template": default_certificate_template,
			}
		)
		certificate.save(ignore_permissions=True)
		return certificate


def get_default_certificate_template():
	default_certificate_template = frappe.db.get_value(
		"Property Setter",
		{
			"doc_type": "LMS Certificate",
			"property": "default_print_format",
		},
		"value",
	)
	if not default_certificate_template:
		default_certificate_template = frappe.db.get_value(
			"Print Format",
			{
				"doc_type": "LMS Certificate",
			},
		)

	return default_certificate_template


def validate_certification_eligibility(course):
	if not frappe.db.exists("LMS Enrollment", {"course": course, "member": frappe.session.user}):
		frappe.throw(_("You are not enrolled in this course."))

	if not frappe.db.get_value("LMS Course", course, "enable_certification"):
		frappe.throw(_("Certification is not enabled for this course."))

	progress = frappe.db.get_value(
		"LMS Enrollment", {"course": course, "member": frappe.session.user}, "progress"
	)
	if progress < 100:
		frappe.throw(_("You have not completed the course yet."))


def has_permission(doc, ptype="read", user=None):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if is_site_administrator(user) or "Moderator" in roles or "Course Creator" in roles:
		return True
	if "Batch Evaluator" in roles:
		return ptype in ("read", "select", "print") or is_assigned_evaluator(doc, ptype, user)
	if doc.owner == user:
		return True
	if ptype not in ("read", "select", "print"):
		return False
	return doc.published


def is_assigned_evaluator(doc, ptype, user):
	"""Scope comes from the stored row: the caller controls every in-memory field,
	`evaluator` included, and must not re-home the certificate outside their batch."""
	if ptype == "create":
		return evaluates_certificate(doc.course, doc.batch_name, doc.member, user)

	stored = frappe.db.get_value(
		"LMS Certificate", doc.name, ["evaluator", "course", "batch_name", "member"], as_dict=True
	)
	if not stored:
		return False
	if stored.evaluator != user and not evaluates_certificate(
		stored.course, stored.batch_name, stored.member, user
	):
		return False
	if (doc.course, doc.batch_name, doc.member) == (stored.course, stored.batch_name, stored.member):
		return True
	return evaluates_certificate(doc.course, doc.batch_name, doc.member, user)


def evaluates_certificate(course, batch_name, member, user):
	"""A course certificate belongs to that course's evaluator in the batch. A batch
	certificate (no course, issued from Generate Certificates) belongs to any evaluator
	tagged on the batch, and only for a student enrolled in it."""
	if course:
		return get_evaluator(course, batch_name) == user
	if not batch_name:
		return False
	tagged = {"parent": batch_name, "parenttype": "LMS Batch"}
	return bool(
		frappe.db.exists("Batch Course", {**tagged, "evaluator": user})
		and frappe.db.exists("LMS Batch Enrollment", {"batch": batch_name, "member": member})
	)


def get_permission_query_conditions(user):
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	if "Moderator" in roles or "Course Creator" in roles or "Batch Evaluator" in roles:
		return None
	return """(`tabLMS Certificate`.published = 1)"""


def on_doctype_update():
	# Backs the locking (member, course, batch_name) read in api.save_*_details.
	frappe.db.add_index("LMS Certificate", ["member", "course", "batch_name"])
