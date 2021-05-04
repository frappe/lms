# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from community.www.courses.utils import get_member_with_email

class LMSBatch(Document):
    def validate(self):
        if not self.code:
            self.generate_code()

    def generate_code(self):
        short_code = frappe.db.get_value("LMS Course", self.course, "short_code")
        course_batches = frappe.get_all("LMS Batch",{"course":self.course})
        self.code = short_code + str(len(course_batches) + 1)

    def get_mentors(self):
        mentors = []
        memberships = frappe.get_all(
                    "LMS Batch Membership",
                    {"batch": self.name, "member_type": "Mentor"},
                    ["member"])
        for membership in memberships:
            member = frappe.db.get_value("Community Member", membership.member, ["full_name", "photo", "abbr"], as_dict=1)
            mentors.append(member)
        return mentors

@frappe.whitelist()
def get_messages(batch):
    messages =  frappe.get_all("LMS Message", {"batch": batch}, ["*"], order_by="creation")
    for message in messages:
        message.message = frappe.utils.md_to_html(message.message)
        member_email = frappe.db.get_value("Community Member", message.author, ["email"])
        if member_email == frappe.session.user:
            message.author_name = "You"
            message.is_author = True
    return messages

@frappe.whitelist()
def save_message(message, batch):
    doc = frappe.get_doc({
        "doctype": "LMS Message",
        "batch": batch,
        "author": get_member_with_email(),
        "message": message
    })
    doc.save(ignore_permissions=True)
