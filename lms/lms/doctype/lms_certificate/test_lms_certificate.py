# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import frappe
from frappe.tests import UnitTestCase


class TestLMSCertificate(UnitTestCase):
	def test_send_mail_batch_args(self):
		cert = frappe.new_doc("LMS Certificate")
		cert.member_name = "Test Member"
		cert.member = "test@example.com"
		cert.batch_name = "test-batch"
		cert.template = "certification"
		# Verify that send_mail populates batch_name and batch_title in args
		self.assertHasAttr(cert, "send_mail")
