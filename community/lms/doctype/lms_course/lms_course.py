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

    def get_topic(self, slug):
        """Returns the topic with given slug in this course as a Document.
        """
        result = frappe.get_all(
            "LMS Topic",
            filters={"course": self.name, "slug": slug})

        if result:
            row = result[0]
            return frappe.get_doc('LMS Topic', row['name'])

    def has_mentor(self, email):
        """Checks if this course has a mentor with given email.
        """
        if not email or email == "Guest":
            return False

        member = self.get_community_member(email)
        if not member:
            return False

        mapping = frappe.get_all("LMS Course Mentor Mapping", {"course": self.name, "mentor": member})
        return mapping != []

    def get_community_member(self, email):
        """Returns the name of Community Member document for a give user.
        """
        try:
            return frappe.db.get_value("Community Member", {"email": email}, "name")
        except frappe.DoesNotExistError:
            return None

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

        member = self.get_community_member(email)
        if not member:
            return False

        doc = frappe.get_doc({
            "doctype": "LMS Course Mentor Mapping",
            "course": self.name,
            "mentor": member
        })
        doc.insert()

    def get_mentors(self):
        """Returns the list of all mentors for this course.
        """
        course_mentors = []
        mentors = frappe.get_all("LMS Course Mentor Mapping", {"course": self.name}, ["mentor"])
        for mentor in mentors:
            member = frappe.get_doc("Community Member", mentor.mentor)
            # TODO: change this to count query
            member.batch_count = len(frappe.get_all("LMS Batch Membership", {"member": member.name, "member_type": "Mentor"}))
            course_mentors.append(member)
        return course_mentors

    def is_mentor(self, email):
        """Checks if given user is a mentor for this course.
        """
        if not email:
            return False
        member = self.get_community_member(email)
        return frappe.db.exists({
            "doctype": "LMS Course Mentor Mapping",
            "course": self.name,
            "mentor": member
        })

    def get_student_batch(self, email):
        """Returns the batch the given student is part of.

        Returns None if the student is not part of any batch.
        """
        if not email:
            return False
        member = self.get_community_member(email)
        result = frappe.db.get_all(
            "LMS Batch Membership",
            filters={
                "member": member,
                "member_type": "Student",
            },
            fields=['batch']
        )
        batches = [row['batch'] for row in result]

        # filter the batches that are for this course
        result = frappe.db.get_all(
            "LMS Batch",
            filters={
                "course": self.name,
                "name": ["IN", batches]
            })
        batches = [row['name'] for row in result]
        if batches:
            return frappe.get_doc("LMS Batch", batches[0])

    def get_instructor(self):
        member_name = self.get_community_member(self.owner)
        return frappe.get_doc("Community Member", member_name)

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
            member = self.get_community_member(email=mentor)
            memberships = frappe.db.get_all(
                "LMS Batch Membership",
                {"member": member},
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

