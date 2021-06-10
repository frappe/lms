# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document

class Chapter(Document):
    def get_lessons(self):
        rows = frappe.db.get_all("Lesson",
            filters={"chapter": self.name},
            fields='name',
            order_by="index_")
        print("rows", rows)
        return [frappe.get_doc('Lesson', row['name']) for row in rows]
