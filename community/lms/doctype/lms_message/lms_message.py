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
        self.publish_message()
        #Todo: Adding email preference field for users
        #self.send_email()

    def publish_message(self):
        template = self.get_message_template()
        message = frappe._dict({
            "author_name": self.author_name,
            "message_time": frappe.utils.format_datetime(self.creation, "dd-mm-yyyy HH:mm"),
            "message": frappe.utils.md_to_html(self.message)
        })

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
                $(".messages").append(template);
                var message_element = document.getElementsByClassName("messages")[0]
		        message_element.scrollTo(0, message_element.scrollHeight);
            """.format(template, message, self.owner)

        frappe.publish_realtime(event="eval_js", message=js, after_commit=True)

    def get_message_template(self):
        return """
                <li class="{% if message.is_author %} ours {% endif %}">
                    <div class="d-flex justify-content-between">
                    <div class="font-weight-bold">
                            {{ message.author_name }}
                    </div>
                    <small class="">
                        {{ message.message_time }}
                    </small>
                    </div>
                    <div class="mt-5">
                        {{ message.message }}
                    </div>
                </li>
            """

    def send_email(self):
        membership = frappe.get_all("LMS Batch Membership", {"batch": self.batch}, ["member"])
        for entry in membership:
            member = frappe.get_doc("User", entry.member)
            if member.name != self.author:
                #Todo: wrap sendmail in frappe.enqueue, else messages takes long to display.
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
    #Todo: Optimize this
    emails = frappe._dict()
    messages = frappe.get_all("LMS Message", {"creation": [">=", add_days(nowdate(), -1)]}, ["message", "batch", "author", "creation"])
    for message in messages:
        membership = frappe.get_all("LMS Batch Membership", {"batch": message.batch}, ["member"])
        for entry in membership:
            member = frappe.db.get_value("User", entry.member, ["name", "email"], as_dict=1)
            if member.name != message.author:
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
            recipients = frappe.db.get_value("User", email, "email"),
            subject = _("Message Digest"),
            header = _("Message Digest"),
            template = "lms_daily_digest",
            args = {
                "batches": group_by_batch
            },
            delayed = False
        )

