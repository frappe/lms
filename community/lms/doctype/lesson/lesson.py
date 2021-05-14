# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from ..lms_topic.section_parser import SectionParser

class Lesson(Document):
    def before_save(self):
        sections = SectionParser().parse(self.body or "")
        self.sections = [self.make_lms_section(i, s) for i, s in enumerate(sections)]

    def get_sections(self):
        return sorted(self.get('sections'), key=lambda s: s.index)

    def make_lms_section(self, index, section):
            s = frappe.new_doc('LMS Section', parent_doc=self, parentfield='sections')
            s.type = section.type
            s.label = section.label
            s.contents = section.contents
            s.index = index
            return s
