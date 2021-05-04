# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from ...utils import slugify

class LMSCourse(Document):
    @staticmethod
    def find(slug):
        """Returns the course with specified slug.
        """
        return find("LMS Course", is_published=True, slug=slug)

    @staticmethod
    def find_all():
        """Returns all published courses.
        """
        return find_all("LMS Course", is_published=True)

    def before_save(self):
        if not self.slug:
            self.slug = self.generate_slug(title=self.title)

    def generate_slug(self, title):
        result = frappe.get_all(
            'LMS Course',
            fields=['slug'])
        slugs = set([row['slug'] for row in result])
        return slugify(title, used_slugs=slugs)

    def __repr__(self):
        return f"<Course#{self.name} {self.slug}>"

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

    def get_instructor(self):
        member_name = self.get_community_member(self.owner)
        return frappe.get_doc("Community Member", member_name)

    def get_chapters(self):
        """Returns all chapters of this course.
        """
        # TODO: chapters should have a way to specify the order
        return find_all("Chapter", course=self.name, order_by="creation")

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
            start_date=[">", now])
        return batches

def find_all(doctype, order_by=None, **filters):
    """Queries the database for documents of a doctype matching given filters.
    """
    rows = frappe.db.get_all(doctype,
        filters=filters,
        fields='*',
        order_by=order_by)
    return [frappe.get_doc(dict(row, doctype=doctype)) for row in rows]

def find(doctype, **filters):
    """Queries the database for a document of given doctype matching given filters.
    """
    rows = frappe.db.get_all(doctype,
        filters=filters,
        fields='*')
    if rows:
        row = rows[0]
    return frappe.get_doc(dict(row, doctype=doctype))
