# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import os
import re
from pathlib import Path
from unittest.mock import patch

import frappe
from bs4 import BeautifulSoup
from frappe import _
from frappe.tests import UnitTestCase
from jinja2 import ChoiceLoader, Environment, FileSystemLoader, PrefixLoader

import lms

SIGNUP_FORM = "lms/templates/signup-form.html"

# The `login.*` helpers a released frappe actually ships. This template is rendered
# into frappe's own login page, so it may lean on these and nothing else: #2691 was a
# 500 on /login caused by reaching for one that exists only on develop.
RELEASED_LOGIN_HELPERS = {"login_handlers", "set_status", "show_field_error"}


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

	def source(self):
		return Path(os.path.dirname(lms.__file__), "templates", "signup-form.html").read_text()

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

	def test_only_calls_login_helpers_released_frappe_ships(self):
		"""An allowlist rather than a denylist, so a newly added `login.*` call has to
		be checked against a released frappe before it can land."""
		used = set(re.findall(r"\blogin\.(\w+)", self.source()))
		self.assertEqual(used - RELEASED_LOGIN_HELPERS, set())

	def test_both_result_handlers_go_through_the_reveal_helper(self):
		"""Released frappe ships these banners as `display: none`, and its own login.js
		re-hides them inline on every keystroke, so dropping the `hidden` class is not
		enough to make one visible. Nothing in python runs this script, so this pins the
		wiring rather than the visibility it buys, which needs a released frappe in a
		browser."""
		source = self.source()
		self.assertIn('const reveal_banner = (banner) => banner.css("display", "flex")', source)

		for handler in ("show_signup_success", "show_signup_error"):
			body = source.split(f"const {handler} = ")[1].split("\n    }")[0]
			self.assertIn("reveal_banner(banner)", body)

	def test_banner_icons_carry_their_size_and_an_inline_fill(self):
		"""Released frappe's `.login-*-banner svg` rule sets a fill and no size. A
		`fill` presentation attribute loses to that rule, which paints the stroked
		lucide glyph as a solid dot, and nothing anywhere sizes the icon."""
		soup = BeautifulSoup(self.render_without_framework_templates(), "html.parser")
		icons = soup.select(".login-error-banner svg, .login-success-banner svg")

		self.assertEqual(len(icons), 2)
		for icon in icons:
			self.assertEqual((icon["width"], icon["height"]), ("16", "16"))
			self.assertIsNone(icon.get("fill"))
			self.assertIn("fill: none", icon["style"])
