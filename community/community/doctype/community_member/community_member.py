# -*- coding: utf-8 -*-
# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
import re
from frappe import _
from frappe.model.document import Document
import random

class CommunityMember(Document):

    def validate(self):
        self.validate_username()
        self.abbr = ("").join([ s[0] for s in self.full_name.split() ])
        if self.route != self.username:
            self.route = self.username

    def validate_username(self):
        if not self.username:
            self.username = create_username_from_email(self.email)

        if self.username:
            if len(self.username) < 4:
                frappe.throw(_("Username must be atleast 4 characters long."))
            if not re.match("^[A-Za-z0-9_]*$", self.username):
                frappe.throw(_("Username can only contain alphabets, numbers and underscore."))
            self.username = self.username.lower()

    def get_course_count(self) -> int:
        """Returns the number of courses authored by this user.
        """
        return frappe.db.count(
            'LMS Course', {
                'owner': self.email
        })

    def get_batch_count(self) -> int:
        """Returns the number of batches authored by this user.
        """
        return frappe.db.count(
            'LMS Batch Membership', {
                'member': self.name,
                'member_type': 'Mentor'
            })

    def __repr__(self):
        return f"<CommunityMember: {self.email}>"

def create_member_from_user(doc, method):
    username = doc.username

    if ( doc.username and  username_exists(doc.username)) or not doc.username:
        username = create_username_from_email(doc.email)

    elif len(doc.username) < 4:
        username = adjust_username(doc.username)

    if username_exists(username):
        username = username + str(random.randint(0,9))

    member = frappe.get_doc({
        "doctype": "Community Member",
        "full_name": doc.full_name,
        "username": username,
        "email": doc.email,
        "route": doc.username,
        "owner": doc.email
    })
    member.save(ignore_permissions=True)

def username_exists(username):
    return frappe.db.exists("Community Member", dict(username=username))

def create_username_from_email(email):
    string = email.split("@")[0]
    return ''.join(e for e in string if e.isalnum())

def adjust_username(username):
    return username.ljust(4, str(random.randint(0,9)))
