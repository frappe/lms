import json
import os

import frappe
from PIL import Image

from lms.lms import api
from lms.lms.api import get_pwa_manifest
from lms.lms.test_helpers import BaseTestUtils


def _manifest():
	response = get_pwa_manifest()
	return json.loads(response.get_data(as_text=True))


class TestPWAManifest(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.set_website_setting("app_logo", None)

	def set_website_setting(self, field, value):
		# Restore through set_single_value, not a bare write: it clears the document
		# cache on the way out, which a savepoint rollback does not do.
		original = frappe.db.get_single_value("Website Settings", field)
		self.addCleanup(frappe.db.set_single_value, "Website Settings", field, original)
		frappe.db.set_single_value("Website Settings", field, value)

	def test_served_as_a_manifest(self):
		response = get_pwa_manifest()

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.headers["Content-Type"], "application/manifest+json")

	def test_declares_standalone_display(self):
		# Without this the installed app opens inside full browser chrome.
		self.assertEqual(_manifest()["display"], "standalone")

	def test_scope_and_id_track_the_lms_route(self):
		manifest = _manifest()
		self.assertEqual(manifest["scope"], manifest["start_url"])
		self.assertEqual(manifest["id"], manifest["start_url"])

	def test_declares_colours_for_the_os_chrome(self):
		manifest = _manifest()
		self.assertEqual(manifest["theme_color"], "#FFFFFF")
		self.assertEqual(manifest["background_color"], "#FFFFFF")

	def test_ships_both_icon_sizes(self):
		sizes = {icon["sizes"] for icon in _manifest()["icons"]}
		self.assertEqual(sizes, {"192x192", "512x512"})

	def test_separates_maskable_from_any(self):
		# A single 'maskable any' entry gets cropped wherever 'any' is used.
		purposes = [icon["purpose"] for icon in _manifest()["icons"]]
		self.assertIn("any", purposes)
		self.assertIn("maskable", purposes)
		self.assertNotIn("maskable any", purposes)

	def test_banner_image_is_not_used_as_an_icon(self):
		"""It is a wide banner, and was being declared as a 192x192 square."""
		self.set_website_setting("banner_image", "/files/wide-banner.png")

		sources = [icon["src"] for icon in _manifest()["icons"]]

		for src in sources:
			self.assertTrue(src.startswith("/assets/lms/frontend/manifest/"))

	def test_name_follows_website_settings(self):
		self.set_website_setting("app_name", "Acme Academy")

		manifest = _manifest()

		self.assertEqual(manifest["name"], "Acme Academy")
		self.assertEqual(manifest["short_name"], "Acme Academy")

	def test_app_logo_is_the_any_icon_at_its_real_size(self):
		"""The manifest ignored Website Settings' app_logo and always shipped the bundled
		icons (from 225f89be4). Guards that a set logo is used, at its real size."""
		logo = f"/files/pwa-logo-{frappe.generate_hash(length=6)}.png"
		path = frappe.get_site_path("public", logo.lstrip("/"))
		Image.new("RGB", (300, 300), "red").save(path)
		self.addCleanup(os.remove, path)
		self.set_website_setting("app_logo", logo)

		icons = _manifest()["icons"]

		self.assertIn({"src": logo, "sizes": "300x300", "type": "image/png", "purpose": "any"}, icons)
		maskable = [icon["src"] for icon in icons if icon["purpose"] == "maskable"]
		self.assertEqual(maskable, ["/assets/lms/frontend/manifest/manifest-icon-512.maskable.png"])

	def assert_app_logo_falls_back(self, size):
		logo = f"/files/pwa-logo-{frappe.generate_hash(length=6)}.png"
		path = frappe.get_site_path("public", logo.lstrip("/"))
		Image.new("RGB", size, "red").save(path)
		self.addCleanup(os.remove, path)
		self.set_website_setting("app_logo", logo)

		icons = [icon for icon in _manifest()["icons"] if icon["purpose"] == "any"]

		self.assertEqual(icons, api.BUNDLED_PWA_ICONS)

	def test_wide_app_logo_falls_back_to_the_bundled_icons(self):
		"""A wordmark would have been the only "any" icon, stretched into a square."""
		self.assert_app_logo_falls_back((600, 150))

	def test_tiny_app_logo_falls_back_to_the_bundled_icons(self):
		"""A 32px favicon is below the 192px a browser needs to install the app."""
		self.assert_app_logo_falls_back((32, 32))

	def test_unreadable_app_logo_falls_back_to_the_bundled_icons(self):
		self.set_website_setting("app_logo", "/files/missing-logo.png")

		sources = {icon["src"] for icon in _manifest()["icons"]}

		self.assertTrue(all(src.startswith("/assets/lms/frontend/manifest/") for src in sources))
