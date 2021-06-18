# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from frappe import _
from community.lms.doctype.lms_batch_membership.lms_batch_membership import create_membership
from community.query import find, find_all

class LMSBatch(Document):
    def validate(self):
        self.validate_if_mentor()

    def validate_if_mentor(self):
        course = frappe.get_doc("LMS Course", self.course)
        if not course.is_mentor(frappe.session.user):
           frappe.throw(_("You are not a mentor of the course {0}").format(course.title))

    def after_insert(self):
        create_membership(batch=self.name, member_type="Mentor")

    def is_member(self, email, member_type=None):
        """Checks if a person is part of a batch.

        If member_type is specified, checks if the person is a Student/Mentor.
        """

        filters = {
            "batch": self.name,
            "member": email
        }
        if member_type:
            filters['member_type'] = member_type
        return frappe.db.exists("LMS Batch Membership", filters)

    def get_messages(self):
        messages =  frappe.get_all("LMS Message", {"batch": self.name}, ["*"], order_by="creation")
        for message in messages:
            message.message = frappe.utils.md_to_html(message.message)
            if message.author == frappe.session.user:
                message.author_name = "You"
                message.is_author = True
        return messages

    def get_membership(self, email):
        """Returns the membership document of given user.
        """
        name = frappe.get_value(
            doctype="LMS Batch Membership",
            filters={
                "batch": self.name,
                "member": email
            },
            fieldname="name")
        return frappe.get_doc("LMS Batch Membership", name)

    def get_current_lesson(self, user):
        """Returns the name of the current lesson for the given user.
        """
        membership = self.get_membership(user)
        return membership and membership.current_lesson

@frappe.whitelist()
def save_message(message, batch):
    doc = frappe.get_doc({
        "doctype": "LMS Message",
        "batch": batch,
        "author": frappe.session.user,
        "message": message
    })
    doc.save(ignore_permissions=True)
