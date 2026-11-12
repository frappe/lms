from unittest.mock import MagicMock, patch

import frappe

from lms.lms.ai import material
from lms.lms.test_helpers import BaseTestUtils

PAGE = "https://docs.example.com/erpnext/sales-invoice"


class TestWebPages(BaseTestUtils):
	"""A web page as material: named by its title, read in the background, cited and opened by
	its address, and removable like a file."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.goal = frappe.get_doc({"doctype": "LMS Goal", "title": "Web Page Skill"}).insert().name
		kb = frappe.get_doc({"doctype": "Flow Knowledge Base", "title": f"Goal {self.goal}"})
		kb.name = kb.title
		kb.db_insert()
		frappe.db.set_value("LMS Goal", self.goal, "knowledge_base", kb.name)

	def _add(self, url=PAGE, title="Sales Invoice · ERPNext Docs"):
		with (
			patch.object(material, "_final_address", side_effect=lambda u: u),
			patch.object(material, "_page_title", return_value=title),
			patch.object(frappe, "enqueue") as enqueue,
		):
			material.add_url(self.goal, url)
		return enqueue

	def test_a_page_is_named_by_its_title_and_read_in_the_background(self):
		enqueue = self._add()
		enqueue.assert_called_once()
		self.assertEqual(enqueue.call_args.kwargs["title"], "Sales Invoice · ERPNext Docs")
		self.assertEqual(material.source_url(self.goal, "Sales Invoice · ERPNext Docs"), PAGE)
		source = material.goal_sources(self.goal)[0]
		self.assertEqual(
			(source["title"], source["url"], source["status"]),
			("Sales Invoice · ERPNext Docs", PAGE, "Reading"),
		)

	def test_adding_the_same_page_again_reads_it_again_under_its_name(self):
		self._add()
		self._add()
		self.assertEqual(list(material.source_urls(self.goal)), ["Sales Invoice · ERPNext Docs"])

	def test_two_pages_with_one_title_get_different_names(self):
		self._add()
		self._add(url=PAGE + "?v=2")
		self.assertEqual(
			sorted(material.source_urls(self.goal)),
			["Sales Invoice · ERPNext Docs", "Sales Invoice · ERPNext Docs (2)"],
		)

	def test_the_worker_hands_the_page_to_the_knowledge_base(self):
		self._add()
		knowledge = MagicMock()
		knowledge.name = f"Goal {self.goal}"
		with patch("frappe.flow.knowledge.knowledge.Knowledge", return_value=knowledge):
			material.read_url(self.goal, PAGE, "Sales Invoice · ERPNext Docs")
		knowledge.add_url.assert_called_once_with(PAGE, title="Sales Invoice · ERPNext Docs")
		self.assertFalse(material.is_reading(self.goal))

	def test_removing_a_page_forgets_its_address(self):
		self._add()
		material.clear_reading(self.goal, ["Sales Invoice · ERPNext Docs"])
		material.remove_source(self.goal, "Sales Invoice · ERPNext Docs")
		self.assertEqual(material.source_urls(self.goal), {})
		self.assertEqual(material.goal_sources(self.goal), [])

	def test_a_redirecting_address_is_followed_to_the_page_itself(self):
		hops = {
			"https://docs.example.com/old": ("https://docs.example.com/erpnext/sales-invoice", True),
			"https://docs.example.com/erpnext/sales-invoice": (None, False),
		}

		def head(url, **kwargs):
			location, redirects = hops[url]
			return MagicMock(is_redirect=redirects, headers={"Location": location} if location else {})

		with (
			patch.object(material, "_public_url", side_effect=lambda u: u),
			patch("requests.head", side_effect=head),
		):
			self.assertEqual(
				material._final_address("https://docs.example.com/old"),
				"https://docs.example.com/erpnext/sales-invoice",
			)

	def test_a_page_without_a_title_is_named_by_its_path(self):
		with patch("requests.get", side_effect=Exception("offline")):
			self.assertEqual(
				material._page_title("https://docs.frappe.io/erpnext/sales-invoice"),
				"Sales Invoice · docs.frappe.io",
			)

	def test_only_public_web_addresses_are_accepted(self):
		for bad in ("ftp://example.com/x", "not a url", "javascript:alert(1)"):
			with self.assertRaises(frappe.ValidationError, msg=bad):
				material._public_url(bad)
