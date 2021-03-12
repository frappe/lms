# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
# import frappe
from frappe.model.document import Document

class LMSSection(Document):
    def __repr__(self):
        return f"<LMSSection {self.label!r}>"
