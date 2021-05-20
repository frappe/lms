# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from ...section_parser import SectionParser

class Lesson(Document):
    def before_save(self):
        sections = SectionParser().parse(self.body or "")
        self.sections = [self.make_lms_section(i, s) for i, s in enumerate(sections)]
        for s in self.sections:
            if s.type == "exercise":
                e = s.get_exercise()
                e.lesson = self.name
                e.save()

    def get_sections(self):
        return sorted(self.get('sections'), key=lambda s: s.index)

    def make_lms_section(self, index, section):
            s = frappe.new_doc('LMS Section', parent_doc=self, parentfield='sections')
            s.type = section.type
            s.id = section.id
            s.label = section.label
            s.contents = section.contents
            s.index = index
            return s

    def get_next(self):
        """Returns the number for the next lesson.

        The return value would be like 1.2, 2.1 etc.
        It will be None if there is no next lesson.
        """


    def get_prev(self):
        """Returns the number for the prev lesson.

        The return value would be like 1.2, 2.1 etc.
        It will be None if there is no next lesson.
        """
