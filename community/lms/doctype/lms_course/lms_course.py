# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from ...utils import slugify
from community.query import find, find_all

class LMSCourse(Document):
    @staticmethod
    def find(name):
        """Returns the course with specified name.
        """
        return find("LMS Course", is_published=True, name=name)

    def autoname(self):
        if not self.name:
            self.name = self.generate_slug(title=self.title)

    @staticmethod
    def find_all():
        """Returns all published courses.
        """
        return find_all("LMS Course", is_published=True)

    def generate_slug(self, title):
        result = frappe.get_all(
            'LMS Course',
            fields=['name'])
        slugs = set([row['name'] for row in result])
        return slugify(title, used_slugs=slugs)

    def __repr__(self):
        return f"<Course#{self.name}>"

    def has_mentor(self, email):
        """Checks if this course has a mentor with given email.
        """
        if not email or email == "Guest":
            return False

        mapping = frappe.get_all("LMS Course Mentor Mapping", {"course": self.name, "mentor": email})
        return mapping != []

    def add_mentor(self, email):
        """Adds a new mentor to the course.
        """
        if not email:
            raise ValueError("Invalid email")
        if email == "Guest":
            raise ValueError("Guest user can not be added as a mentor")

        # given user is already a mentor
        if self.has_mentor(email):
            return

        doc = frappe.get_doc({
            "doctype": "LMS Course Mentor Mapping",
            "course": self.name,
            "mentor": email
        })
        doc.insert()

    def get_mentors(self):
        """Returns the list of all mentors for this course.
        """
        course_mentors = []
        mentors = frappe.get_all("LMS Course Mentor Mapping", {"course": self.name}, ["mentor"])
        for mentor in mentors:
            member = frappe.get_doc("User", mentor.mentor)
            # TODO: change this to count query
            member.batch_count = len(frappe.get_all("LMS Batch Membership", {"member": member.name, "member_type": "Mentor"}))
            course_mentors.append(member)
        return course_mentors

    def is_mentor(self, email):
        """Checks if given user is a mentor for this course.
        """
        if not email:
            return False
        return frappe.db.exists({
            "doctype": "LMS Course Mentor Mapping",
            "course": self.name,
            "mentor": email
        })

    def get_student_batch(self, email):
        """Returns the batch the given student is part of.

        Returns None if the student is not part of any batch.
        """
        if not email:
            return

        batch_name = frappe.get_value(
            doctype="LMS Batch Membership",
            filters={
                "course": self.name,
                "member_type": "Student",
                "member": email
            },
            fieldname="batch")
        return batch_name and frappe.get_doc("LMS Batch", batch_name)

    def get_instructor(self):
        return frappe.get_doc("User", self.owner)

    def get_chapters(self):
        """Returns all chapters of this course.
        """
        # TODO: chapters should have a way to specify the order
        return find_all("Chapter", course=self.name, order_by="creation")

    def get_batch(self, batch_name):
        return find("LMS Batch", name=batch_name, course=self.name)

    def get_batches(self, mentor=None):
        batches = find_all("LMS Batch", course=self.name)
        if mentor:
            # TODO: optimize this
            memberships = frappe.db.get_all(
                "LMS Batch Membership",
                {"member": mentor},
                ["batch"])
            batch_names = {m.batch for m in memberships}
            return [b for b in batches if b.name in batch_names]

    def get_upcoming_batches(self):
        now = frappe.utils.nowdate()
        batches =  find_all("LMS Batch",
            course=self.name,
            start_date=[">", now],
            status="Active",
            visibility="Public")
        return batches

    def get_chapter(self, index):
        return find("Chapter", course=self.name, index_=index)

    def get_lesson(self, chapter_index, lesson_index):
        chapter_name = frappe.get_value(
            "Chapter",
            {"course": self.name, "index_": chapter_index},
            "name")
        lesson_name = chapter_name and frappe.get_value(
            "Lesson",
            {"chapter": chapter_name, "index_": lesson_index},
            "name")
        return lesson_name and frappe.get_doc("Lesson", lesson_name)

    def get_outline(self):
        return CourseOutline(self)

class CourseOutline:
    def __init__(self, course):
        self.course = course
        self.chapters = self.get_chapters()
        self.lessons = self.get_lessons()

    def get_next(self, current):
        numbers = sorted(lesson['number'] for lesson in self.lessons)
        try:
            index = numbers.index(current)
            return numbers[index+1]
        except IndexError:
            return None

    def get_prev(self, current):
        numbers = sorted(lesson['number'] for lesson in self.lessons)
        try:
            index = numbers.index(current)
            if index == 0:
                return None
            return numbers[index-1]
        except IndexError:
            return None

    def get_chapters(self):
        return frappe.db.get_all("Chapter",
            filters={"course": self.course.name},
            fields=["name", "title", "index_"])

    def get_lessons(self):
        chapters = [c['name'] for c in self.chapters]
        lessons = frappe.db.get_all("Lesson",
            filters={"chapter": ["IN", chapters]},
            fields=["name", "title", "chapter", "index_"])

        chapter_numbers = {c['name']: c['index_'] for c in self.chapters}
        for lesson in lessons:
            lesson['number'] = "{}.{}".format(chapter_numbers[lesson['chapter']], lesson['index_'])
        return lessons
