# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
import json
from ...utils import slugify
from community.query import find, find_all
from frappe.utils import flt, cint
from ...utils import slugify

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
        return frappe.db.count("LMS Course Mentor Mapping",
            {
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
        chapters = []
        for row in self.chapters:
            chapter_details = frappe.db.get_value("Chapter", row.chapter,
                                                ["name", "title", "description"],
                                                as_dict=True)
            chapter_details.idx = row.idx
            chapters.append(chapter_details)
        return chapters

    def get_lessons(self, chapter=None):
        """ If chapter is passed, returns lessons of only that chapter.
        Else returns lessons of all chapters of the course """
        lessons = []

        if chapter:
            return self.get_lesson_details(chapter)

        for chapter in self.get_chapters():
            lesson = self.get_lesson_details(chapter)
            lessons += lesson

        return lessons

    def get_lesson_details(self, chapter):
        lessons = []
        lesson_list = frappe.get_all("Lessons", {"parent": chapter.name},
                                        ["lesson", "idx"], order_by="idx")
        for row in lesson_list:
            lesson_details = frappe.get_doc("Lesson", row.lesson)
            lesson_details.number = flt("{}.{}".format(chapter.idx, row.idx))
            lessons.append(lesson_details)
        return lessons

    def get_slugified_chapter_title(self, chapter):
        return slugify(chapter)

    def get_course_progress(self):
        """ Returns the course progress of the session user """
        lesson_count = len(self.get_lessons())
        completed_lessons = frappe.db.count("LMS Course Progress",
                                {
                                    "course": self.name,
                                    "owner": frappe.session.user,
                                    "status": "Complete"
                                })
        precision = cint(frappe.db.get_default("float_precision")) or 3
        if not lesson_count:
            return 0
        return flt(((completed_lessons/lesson_count) * 100), precision)

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

    def get_lesson_index(self, lesson_name):
        """Returns the {chapter_index}.{lesson_index} for the lesson.
        """
        lesson = frappe.db.get_value("Lessons", {"lesson": lesson_name}, ["idx", "parent"], as_dict=True)
        chapter = frappe.db.get_value("Chapters", {"chapter": lesson.parent}, ["idx"], as_dict=True)
        return f"{chapter.idx}.{lesson.idx}"

    def reindex_exercises(self):
        for i, c in enumerate(self.get_chapters(), start=1):
            if c.index_ != i:
                c.index_ = i
                c.save()
            self._reindex_exercises_in_chapter(c)

    def _reindex_exercises_in_chapter(self, c):
        i = 1
        for lesson in self.get_lessons(c):
            for exercise in lesson.get_exercises():
                exercise.index_ = i
                exercise.index_label = f"{c.index_}.{i}"
                exercise.save()
                i += 1

    def get_learn_url(self, lesson_number):
        if not lesson_number:
            return
        return f"/courses/{self.name}/learn/{lesson_number}"

    def get_membership(self, member, batch=None):
        filters = {
            "member": member,
            "course": self.name
        }
        if batch:
            filters["batch"] = batch

        membership = frappe.db.get_value("LMS Batch Membership",
                        filters,
                        ["name", "batch", "current_lesson", "member_type"],
                        as_dict=True)

        if membership and membership.batch:
            membership.batch_title = frappe.db.get_value("LMS Batch", membership.batch, "title")
        return membership

    def get_all_memberships(self, member):
        all_memberships = frappe.get_all("LMS Batch Membership", {"member": member, "course": self.name}, ["batch"])
        for membership in all_memberships:
            membership.batch_title = frappe.db.get_value("LMS Batch", membership.batch, "title")
        return all_memberships

    def get_mentors(self, batch=None):
        filters = {
            "course": self.name,
            "member_type": "Mentor"
        }
        if batch:
            filters["batch"] = batch

        memberships = frappe.get_all(
                    "LMS Batch Membership",
                    filters,
                    ["member"])
        member_names = [m['member'] for m in memberships]
        return find_all("User", name=["IN", member_names])

    def get_students(self, batch=None):
        """Returns (email, full_name, username) of all the students of this batch as a list of dict.
        """
        filters = {
            "course": self.name,
            "member_type": "Student"
        }
        if batch:
            filters["batch"] = batch
        memberships = frappe.get_all(
                    "LMS Batch Membership",
                    filters,
                    ["member"])
        member_names = [m['member'] for m in memberships]
        return find_all("User", name=["IN", member_names])

    def get_tags(self):
        return self.tags.split(",") if self.tags else []

    def get_reviews(self):
        reviews = frappe.get_all("LMS Course Review",
                    {
                        "course": self.name
                    },
                    ["review", "rating", "owner"],
                    order_by= "creation desc")

        for review in reviews:
            review.owner_details = frappe.get_doc("User", review.owner)

        return reviews

    def is_eligible_to_review(self, membership):
        """ Checks if user is eligible to review the course """
        if not membership:
            return False
        if frappe.db.count("LMS Course Review",
                {
                    "course": self.name,
                    "owner": frappe.session.user
                }):
            return False
        return True

    def get_average_rating(self):
        ratings = [review.rating for review in self.get_reviews()]
        if not len(ratings):
            return None
        return sum(ratings)/len(ratings)

    def get_progress(self, lesson):
        return frappe.db.get_value("LMS Course Progress",
                {
                    "course": self.name,
                    "owner": frappe.session.user,
                    "lesson": lesson
                },
                ["status"])

    def get_neighbours(self, current, lessons):
        current = flt(current)
        numbers = sorted(lesson.number for lesson in lessons)
        index = numbers.index(current)
        return {
                "prev": numbers[index-1] if index-1 >= 0 else None,
                "next": numbers[index+1] if index+1 < len(numbers) else None
            }

@frappe.whitelist()
def reindex_exercises(doc):
    course_data = json.loads(doc)
    course = frappe.get_doc("LMS Course", course_data['name'])
    course.reindex_exercises()
    frappe.msgprint("All exercises in this course have been re-indexed.")
