from urllib.parse import parse_qs, urlsplit

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.www import certificate as certificate_page


class TestCertificatePdfUrl(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self._create_user("frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"])
		course = self._create_course(title="Certificate PDF Course")
		student = self._create_user("cert-pdf@example.com", "Cert", "Pdf", ["LMS Student"])
		self._create_enrollment(student.name, course.name)
		self.certificate = self._create_certificate(course.name, student.name)
		frappe.db.set_single_value("Print Settings", "with_letterhead", 1)
		letter_head = frappe.get_doc(
			{
				"doctype": "Letter Head",
				"letter_head_name": f"Sandbox Letter Head {frappe.generate_hash(length=6)}",
				"source": "HTML",
				"letter_head_for": "DocType",
				"content": "{% set company = frappe._dict() %}<p>{{ company }}</p>",
				"is_default": 1,
			}
		)
		# nosemgrep: lms-unjustified-ignore-permissions - fixture seeding, not the permission under test
		letter_head.insert(ignore_permissions=True)

	def _redirect_params(self):
		frappe.form_dict.certificate_id = self.certificate.name
		with self.assertRaises(frappe.Redirect):
			certificate_page.get_context(frappe._dict())
		return {
			key: values[0]
			for key, values in parse_qs(urlsplit(frappe.local.flags.redirect_location).query).items()
		}

	def test_the_certificate_renders_under_an_unsafe_default_letter_head(self):
		# Regression: a default letter head using frappe._dict() 500'd the certificate PDF
		# (#3031, fixed in #3039).
		params = self._redirect_params()
		html = frappe.get_print(
			params["doctype"],
			params["name"],
			params["format"],
			no_letterhead=params.get("no_letterhead"),
		)
		self.assertTrue(html)
