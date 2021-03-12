# -*- coding: utf-8 -*-
# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.website.website_generator import WebsiteGenerator
import re
from frappe import _

class CommunityMember(WebsiteGenerator):
	def get_context(self, context):
		context.abbr = ("").join([ s[0] for s in self.full_name.split() ])
		return context

	def validate(self):
		self.validate_user_name()
		if self.route != self.user_name:
			self.route = self.user_name	
	
	def validate_user_name(self):
		if self.user_name:
			if len(self.user_name) < 4:
				frappe.throw(_("Username must be atleast 4 characters long."))
			if not re.match("^[A-Za-z0-9]*$", self.user_name):
				frappe.throw(_("Username can only contain alphabets, and numbers."))
			self.user_name = self.user_name.lower()
	
	def autoname(self):
		self.name = self.user_name

def create_member_from_user(doc, method):
	member = frappe.get_doc({
		"doctype": "Community Member",
		"full_name": doc.full_name,
		"user_name": doc.username,
		"email": doc.email,
		"route": doc.username,
		"owner": doc.email
	})
	member.save(ignore_permissions=True)
