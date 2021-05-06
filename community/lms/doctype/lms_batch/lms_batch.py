# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from community.www.courses.utils import get_member_with_email
from community.query import find, find_all

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
        member_names = [m['member'] for m in memberships]
        return find_all("Community Member", name=["IN", member_names])

    def is_member(self, email):
        """Checks if a person is part of a batch.
        """
        member = find("Community Member", email=email)
        return member and frappe.db.exists(
                    "LMS Batch Membership",
                    {"batch": self.name, "member": member.name})

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
