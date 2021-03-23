# -*- coding: utf-8 -*-
# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.website.website_generator import WebsiteGenerator
import re
from frappe import _
from frappe.model.rename_doc import rename_doc

class CommunityMember(WebsiteGenerator):
	def get_context(self, context):
		context.abbr = ("").join([ s[0] for s in self.full_name.split() ])
		return context

	def validate(self):
		self.validate_username()
		if self.route != self.username:
			self.route = self.username	
	
	def validate_username(self):
		if self.username:
			if len(self.username) < 4:
				frappe.throw(_("Username must be atleast 4 characters long."))
			if not re.match("^[A-Za-z0-9_]*$", self.username):
				frappe.throw(_("Username can only contain alphabets, numbers and underscore."))
			self.username = self.username.lower()

	def on_update(self):
		if self.username != self.name:
			rename_doc(self.doctype, self.name, self.username, force=False, merge=False, ignore_permissions=True, ignore_if_exists=False)

def create_member_from_user(doc, method):
	member = frappe.get_doc({
		"doctype": "Community Member",
		"full_name": doc.full_name,
		"username": doc.username if len(doc.username) > 3 else doc.username + "_community",
		"email": doc.email,
		"route": doc.username,
		"owner": doc.email
	})
	member.save(ignore_permissions=True)
