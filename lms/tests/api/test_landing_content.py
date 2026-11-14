import frappe
from frappe.tests import IntegrationTestCase

from lms.lms.api import get_landing_content


class TestGetLandingContent(IntegrationTestCase):
	def _set(self, **values):
		frappe.db.set_single_value("LMS Settings", values)
		frappe.clear_cache(doctype="LMS Settings")

	def _guest_content(self):
		frappe.set_user("Guest")
		try:
			return get_landing_content()
		finally:
			frappe.set_user("Administrator")

	def test_returns_nothing_while_the_landing_page_is_off(self):
		self._set(show_guest_landing=0)

		self.assertEqual(self._guest_content(), {"enabled": False})

	def test_returns_the_configured_brand_hero_slides_branches_and_contact(self):
		self._set(
			show_guest_landing=1,
			landing_brand_name="Test Institute",
			landing_primary_colour="#123456",
			landing_hero_headline="Headline here",
			landing_contact_phone="+91 00000 00000",
		)
		settings = frappe.get_doc("LMS Settings")
		settings.append(
			"landing_slides",
			{"title": "Slide one", "text": "Body", "cta_label": "Go", "cta_link": "/courses"},
		)
		settings.append("landing_branches", {"label": "Main", "branch_name": "Main Branch", "phone": "+91 1"})
		settings.flags.ignore_validate = False
		settings.save()

		content = self._guest_content()

		self.assertTrue(content["enabled"])
		self.assertEqual(content["brand"]["name"], "Test Institute")
		self.assertEqual(content["brand"]["primary_colour"], "#123456")
		self.assertEqual(content["hero"]["headline"], "Headline here")
		self.assertEqual(content["contact"]["phone"], "+91 00000 00000")
		self.assertEqual(content["slides"][0]["cta"], {"label": "Go", "href": "/courses"})
		self.assertEqual(content["branches"][0]["name"], "Main Branch")

	def test_blank_brand_name_falls_back_to_the_site_name(self):
		self._set(show_guest_landing=1, landing_brand_name="")

		content = self._guest_content()

		self.assertEqual(content["brand"]["name"], frappe.get_cached_value("Website Settings", None, "app_name") or "")


class TestLandingSettingsValidation(IntegrationTestCase):
	def test_a_colour_that_is_not_hex_is_refused(self):
		settings = frappe.get_single("LMS Settings")
		settings.landing_primary_colour = "red"

		with self.assertRaises(frappe.ValidationError):
			settings.save()

	def test_a_slide_link_that_is_not_a_path_or_https_is_refused(self):
		settings = frappe.get_single("LMS Settings")
		settings.append("landing_slides", {"title": "Bad", "cta_link": "javascript:alert(1)"})

		with self.assertRaises(frappe.ValidationError):
			settings.save()
