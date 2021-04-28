# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import add_days, nowdate
from community.www.courses.utils import get_batch_members

class LMSMessage(Document):
	""" def after_insert(self):
		self.send_email() """

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

def publish_message(doc, method):
	email = frappe.db.get_value("Community Member", doc.author, "email")
	template = get_message_template()
	message = frappe._dict()
	message.author_name = doc.author_name
	message.message_time = frappe.utils.pretty_date(doc.creation)
	message.message = frappe.utils.md_to_html(doc.message)

	js = """
			$(".msger-input").val("");
			var template = `{0}`;
			var message = {1};
			var session_user = ("{2}" == frappe.session.user) ? true : false;
			message.author_name = session_user ? "You" : message.author_name
			message.is_author = session_user;
			template = frappe.render_template(template, {{
				"message": message
			}})
			$(".message-section").append(template);
		""".format(template, message, email)

	frappe.publish_realtime(event="eval_js", message=js, after_commit=True)

def get_message_template():
	return """  
			<div class="discussion {% if message.is_author %} is-author {% endif %}">
				<div class="d-flex justify-content-between">
				<div class="font-weight-bold">
						{{ message.author_name }}
				</div>
				<div class="text-muted">
					{{ message.message_time }}
				</div>
				</div>
				<div class="mt-5">
					{{ message.message }}
				</div>
			</div>
		"""