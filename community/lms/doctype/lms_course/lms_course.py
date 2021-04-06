# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from ...utils import slugify

class LMSCourse(Document):
    def before_save(self):
        if not self.slug:
            self.slug = self.generate_slug(title=self.title)

    def generate_slug(self, title):
        result = frappe.get_all(
            'LMS Course',
            fields=['slug'])
        slugs = set([row['slug'] for row in result])
        return slugify(title, used_slugs=slugs)

    def get_topic(self, slug):
        """Returns the topic with given slug in this course as a Document.
        """
        result = frappe.get_all(
            "LMS Topic",
            filters={"course": self.name, "slug": slug})

        if result:
            row = result[0]
            return frappe.get_doc('LMS Topic', row['name'])
