# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import os
from pathlib import Path
from unittest.mock import patch

import frappe
from frappe import _
from frappe.tests import UnitTestCase
from jinja2 import ChoiceLoader, Environment, FileSystemLoader, PrefixLoader

import lms

SIGNUP_FORM = "lms/templates/signup-form.html"


class TestSignupForm(UnitTestCase):
	def patched_settings(self, lms_settings):
		original = frappe.db.get_single_value

		def get_single_value(doctype, fieldname, *args, **kwargs):
			if doctype == "LMS Settings":
				return lms_settings.get(fieldname)
			return original(doctype, fieldname, *args, **kwargs)

		return patch.object(frappe.db, "get_single_value", side_effect=get_single_value)

	def render(self, **lms_settings):
		with self.patched_settings(lms_settings):
			return frappe.get_template(SIGNUP_FORM).render({})

	def render_without_framework_templates(self, **lms_settings):
		"""Render with only LMS's own templates on the loader path, the way a site
		on a released frappe sees it."""
		lms_package = os.path.dirname(lms.__file__)
		env = Environment(
			loader=ChoiceLoader(
				[
					PrefixLoader({"lms": FileSystemLoader(lms_package)}),
					FileSystemLoader(lms_package),
				]
			)
		)
		env.globals.update(frappe=frappe, _=_)

		with self.patched_settings(lms_settings):
			return env.get_template(SIGNUP_FORM).render({})

	def test_renders_the_result_banners(self):
		html = self.render()
		self.assertIn("login-error-banner", html)
		self.assertIn("login-success-banner", html)

	def test_submit_button_is_an_es_button(self):
		html = self.render()
		self.assertIn('class="es-button w-full btn-signup"', html)

	def test_does_not_reuse_the_framework_signup_class(self):
		html = self.render()
		self.assertIn("signup-form", html)
		self.assertNotIn("form-signup", html)

	def test_already_registered_message_links_to_login(self):
		html = self.render()
		self.assertIn("You are already registered.", html)
		self.assertIn('href=\\"#login\\"', html)

	def test_optional_fields_render_only_when_configured(self):
		html = self.render()
		self.assertNotIn('id="user_category"', html)
		self.assertNotIn('id="signup-terms"', html)

		html = self.render(user_category=1, custom_signup_content="I agree to the terms")
		self.assertIn('id="user_category"', html)
		self.assertIn('id="signup-terms"', html)
		self.assertIn("I agree to the terms", html)
		self.assertIn("icon-chevrons-up-down", html)

	def test_renders_without_the_frameworks_login_templates(self):
		"""/login renders this template, so an include the running frappe does not
		ship takes the whole login page down with a 500."""
		html = self.render_without_framework_templates()
		self.assertIn("login-error-banner", html)
		self.assertIn("login-success-banner", html)

	def test_does_not_call_login_helpers_missing_from_released_frappe(self):
		source = Path(os.path.dirname(lms.__file__), "templates", "signup-form.html").read_text()
		self.assertNotIn("login.show_success_banner", source)
		self.assertNotIn("login.hide_loading", source)
