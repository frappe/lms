# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
# import frappe
from frappe.model.document import Document

class CommunityProjectMember(Document):
    def validate(self):
        self.validate_if_already_member()
    
    def validate_if_already_member(self):
        if frappe.get_all("Community Project Member", {"owner": self.owner}):
            frappe.throw(_("You have already applied for the membership of this project."))

