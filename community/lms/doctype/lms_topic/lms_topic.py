# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from .section_parser import SectionParser
from ...utils import slugify

class LMSTopic(Document):
    def before_save(self):
        course = self.get_course()
        if not self.slug:
            self.slug = self.generate_slug(title=self.title)

        sections = SectionParser().parse(self.description or "")
        self.sections = [self.make_lms_section(i, s) for i, s in enumerate(sections)]

    def get_course(self):
        return frappe.get_doc("LMS Course", self.course)

    def generate_slug(self, title):
        result = frappe.get_all(
            'LMS Topic',
            filters={'course': self.course},
            fields=['slug'])
        slugs = set([row['slug'] for row in result])
        return slugify(title, used_slugs=slugs)

    def get_sections(self):
        return sorted(self.sections, key=lambda s: s.index)

    def make_lms_section(self, index, section):
            s = frappe.new_doc('LMS Section', parent_doc=self, parentfield='sections')
            s.type = section.type
            s.label = section.label
            s.contents = section.contents
            s.index = index
            return s



