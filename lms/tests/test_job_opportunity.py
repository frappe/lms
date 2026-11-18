import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestJobOpportunityAutoname(BaseTestUtils):
	def _post_job(self, job_title, company_name):
		return frappe.get_doc(
			{
				"doctype": "Job Opportunity",
				"job_title": job_title,
				"location": "Remote",
				"type": "Full Time",
				"description": "A job.",
				"company_name": company_name,
				"company_website": "https://example.com",
				"company_email_address": "jobs@example.com",
				"company_logo": "https://example.com/logo.png",
				"country": frappe.db.get_value("Country", {}, "name"),
			}
		).insert()

	def test_a_repeated_title_and_company_gets_a_suffixed_name(self):
		"""autoname deduped the slug against LMS Course, so a second job with the same
		title and company raised DuplicateEntryError. Guards the -2 suffix."""
		suffix = frappe.generate_hash(length=6)
		first = self._post_job(f"Consultant {suffix}", "Acme")
		second = self._post_job(f"Consultant {suffix}", "Acme")

		self.assertEqual(first.name, f"consultant-{suffix}-acme")
		self.assertEqual(second.name, f"consultant-{suffix}-acme-2")
