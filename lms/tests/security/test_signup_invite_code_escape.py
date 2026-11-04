import frappe
from bs4 import BeautifulSoup
from frappe.tests import IntegrationTestCase
from frappe.utils import set_request
from frappe.website.serve import get_response

PAYLOAD = '"><script>alert(1)</script>'


class TestSignupInviteCodeEscape(IntegrationTestCase):
	def setUp(self):
		self.addCleanup(frappe.set_user, frappe.session.user)
		frappe.set_user("Guest")

	def render_signup_form(self, invite_code):
		set_request(method="GET", path="/new-sign-up", query_string={"invite_code": invite_code})
		self.addCleanup(setattr, frappe.local, "form_dict", frappe.local.form_dict)
		frappe.local.form_dict = frappe._dict(invite_code=invite_code)
		html = frappe.safe_decode(get_response().get_data())
		return BeautifulSoup(html, "html.parser").find("form", id="new-sign-up")

	def test_invite_code_cannot_break_out_of_the_input(self):
		"""Reflected XSS since the invite flow landed (#42, 2021): the query value was
		rendered into the input unescaped. Test added with the `| e` fix."""
		form = self.render_signup_form(PAYLOAD)
		self.assertIsNone(form.find("script"))
		self.assertEqual(form.find(id="invite_code")["value"], PAYLOAD)

	def test_plain_invite_code_is_prefilled(self):
		form = self.render_signup_form("abc123")
		self.assertEqual(form.find(id="invite_code")["value"], "abc123")
