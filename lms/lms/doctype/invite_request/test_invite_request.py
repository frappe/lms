# Copyright (c) 2021, FOSS United and Contributors
# See license.txt
import unittest

import frappe

from lms.lms.doctype.invite_request.invite_request import (
	create_invite_request,
	update_invite,
)


class TestInviteRequest(unittest.TestCase):
	@classmethod
	def setUpClass(self):
		create_invite_request("test_invite@example.com")

	def test_create_invite_request(self):
		if frappe.db.exists("Invite Request", {"invite_email": "test_invite@example.com"}):
			invite = frappe.db.get_value(
				"Invite Request",
				filters={"invite_email": "test_invite@example.com"},
				fieldname=["invite_email", "status", "signup_email"],
				as_dict=True,
			)
			self.assertEqual(invite.status, "Approved")
			self.assertEqual(invite.signup_email, None)

	def test_create_invite_request_update(self):
		if frappe.db.exists("Invite Request", {"invite_email": "test_invite@example.com"}):

			data = {
				"signup_email": "test_invite@example.com",
				"username": "test_invite",
				"full_name": "Test Invite",
				"password": "Test@invite",
				"invite_code": frappe.db.get_value(
					"Invite Request", {"invite_email": "test_invite@example.com"}, "name"
				),
			}

			update_invite(data)
			invite = frappe.db.get_value(
				"Invite Request",
				filters={"invite_email": "test_invite@example.com"},
				fieldname=[
					"invite_email",
					"status",
					"signup_email",
					"full_name",
					"username",
					"invite_code",
					"name",
				],
				as_dict=True,
			)
			self.assertEqual(invite.signup_email, "test_invite@example.com")
			self.assertEqual(invite.full_name, "Test Invite")
			self.assertEqual(invite.username, "test_invite")
			self.assertEqual(invite.invite_code, invite.name)
			self.assertEqual(invite.status, "Registered")

			user = frappe.db.get_value(
				"User",
				"test_invite@example.com",
				fieldname=["first_name", "username", "send_welcome_email", "user_type"],
				as_dict=True,
			)
			self.assertTrue(user)
			self.assertEqual(user.first_name, invite.full_name.split(" ")[0])
			self.assertEqual(user.username, invite.username)
			self.assertEqual(user.send_welcome_email, 0)
			self.assertEqual(user.user_type, "Website User")

	@classmethod
	def tearDownClass(self):
		if frappe.db.exists("User", "test_invite@example.com"):
			frappe.delete_doc("User", "test_invite@example.com")

		invite_request = frappe.db.exists(
			"Invite Request", {"invite_email": "test_invite@example.com"}
		)
		if invite_request:
			frappe.delete_doc("Invite Request", invite_request)
