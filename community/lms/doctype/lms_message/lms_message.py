# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import add_days, nowdate
class LMSMessage(Document):
	def after_insert(self):
		message = self.as_dict()
		message['broadcast'] = True
		frappe.publish_realtime('new_lms_message', message, after_commit=True)
		self.send_email()
		
	def send_email(self):
		membership = frappe.get_all("LMS Batch Membership", {"batch": self.batch}, ["member"])
		for entry in membership:
			member = frappe.get_doc("Community Member", entry.member)
			if member.name != self.author and member.email_preference == "Email on every Message":
				frappe.sendmail(
					recipients = member.email,
					subject = _("New Message on ") + self.batch,
					header = _("New Message on ") + self.batch,
					template = "lms_message",
					args = {
						"author": self.author,
						"message": frappe.utils.md_to_html(self.message),
						"creation": frappe.utils.format_datetime(self.creation, "medium"),
						"course": frappe.db.get_value("LMS Batch", self.batch, ["course"])
					}
				)
def send_daily_digest():
	emails = frappe._dict()
	messages = frappe.get_all("LMS Message", {"creation": [">=", add_days(nowdate(), -1)]}, ["message", "batch", "author", "creation"])
	for message in messages:
		membership = frappe.get_all("LMS Batch Membership", {"batch": message.batch}, ["member"])
		for entry in membership:
			member = frappe.db.get_value("Community Member", entry.member, ["name", "email_preference", "email"], as_dict=1)
			if member.name != message.author and member.email_preference == "One Digest Mail per day":
				if member.name in emails.keys():
					emails[member.name]["messages"].append(message)
				else:
					emails[member.name] = frappe._dict({
						"email": member.email,
						"messages": [message]
					})
	for email in emails:
		group_by_batch = frappe._dict()
		for message in emails[email]["messages"]:
			if message.batch in group_by_batch.keys():
				group_by_batch[message.batch].append(message)
			else:
				group_by_batch[message.batch] = [message]
		frappe.sendmail(
			recipients = frappe.db.get_value("Community Member", email, "email"),
			subject = _("Message Digest"),
			header = _("Message Digest"),
			template = "lms_daily_digest",
			args = {
				"batches": group_by_batch
			},
			delayed = False
		)