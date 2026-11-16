from unittest.mock import patch

import frappe
from frappe.tests import UnitTestCase

from lms.lms import utils


class TestLmsPathWarning(UnitTestCase):
	def setUp(self):
		super().setUp()
		self.routed = utils.get_routed_lms_path()
		self.original = frappe.local.conf.get("lms_path")
		utils.warn_if_lms_path_differs_from_routes.clear_cache()

	def tearDown(self):
		frappe.local.conf["lms_path"] = self.original
		utils.warn_if_lms_path_differs_from_routes.clear_cache()
		super().tearDown()

	def _check(self, site_path):
		frappe.local.conf["lms_path"] = site_path
		with patch("frappe.logger") as logger:
			utils.warn_if_lms_path_differs_from_routes()
			utils.warn_if_lms_path_differs_from_routes()
		return logger.return_value.warning.call_args_list

	def test_a_site_path_that_differs_from_the_routes_is_warned_once(self):
		"""A per-site lms_path was silently not routed since #2001 (hooks read it at import).
		Added for audit finding #71."""
		warnings = self._check(f"{self.routed}-elsewhere")

		self.assertEqual(len(warnings), 1)
		self.assertIn("common_site_config", warnings[0].args[0])

	def test_a_site_path_that_matches_the_routes_is_silent(self):
		"""Control: a matching path logs nothing (audit finding #71)."""
		self.assertEqual(self._check(f"/{self.routed}/"), [])
