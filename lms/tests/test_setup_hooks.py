import frappe
from frappe.tests import IntegrationTestCase


class TestSetupHooks(IntegrationTestCase):
	def test_learning_asks_for_setup_to_finish_at_login(self):
		# On Frappe Cloud the framework finishes the desk wizard at the owner's first login only
		# for apps that opt in. Without this, the owner sees the wizard before Learning's setup page.
		self.assertTrue(frappe.get_hooks("setup_wizard_auto_complete", app_name="lms"))
