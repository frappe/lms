# -*- coding: utf-8 -*-
# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
import re
from frappe.website.website_generator import WebsiteGenerator
from frappe import _

class CommunityCourseMember(WebsiteGenerator):
	def validate(self):
		self.validate_user_name()
		if not self.route:
			self.route = "username/" + self.user_name	
	
	def validate_user_name(self):
		if len(self.user_name) < 4:
			frappe.throw(_("Username must be atleast 4 characters long."))
		if not re.match("^[A-Za-z0-9_]*$", self.user_name):
			frappe.throw(_("Username can only contain alphabets, numbers, and underscore."))
		self.user_name = self.user_name.lower()

	def after_insert(self):
		if frappe.db.exists("User", self.email):
			user = frappe.get_doc("User", self.email)
		else:
			user, update_password_link = self.create_user()
			self.send_email(update_password_link)

	def send_email(self, update_password_link):

		args = {
			'update_password_link': update_password_link,
			'full_name': self.full_name,
		}

		frappe.sendmail(
			recipients=self.email,
			sender="Administrator",
			subject=_("Set your Password"), 
			template="community_course_membership",
			reference_doctype=self.doctype, 
			reference_name=self.name,
			send_priority=0, 
			queue_separately=True, 
			args=args)

	def create_user(self):
		user = 	frappe.get_doc({
					"doctype": "User",
					"email": self.email,
					"first_name": self.full_name.split(" ")[0],
					"full_name": self.full_name,
					"username": self.user_name,
					"send_welcome_email": 0,
					"user_type": 'Website User',
					"redirect_url": "username/" + self.name
				})
		user.save(ignore_permissions=True)
		update_password_link = user.reset_password()
		return user, update_password_link
