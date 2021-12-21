# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document

class LMSSettings(Document):
	pass

@frappe.whitelist()
def check_profile_restriction():
    force_profile_completion = frappe.db.get_single_value("LMS Settings", "force_profile_completion")
    user = frappe.db.get_value("User", frappe.session.user, ["profile_complete", "username"], as_dict=True)
    return {
        "restrict": force_profile_completion and not user.profile_complete,
        "username": user.username,
        "prefix": frappe.get_hooks("profile_url_prefix")[0] or "/users/"
    }
