# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
import json
from ...utils import slugify
from school.query import find, find_all
from frappe.utils import flt, cint
from school.lms.utils import get_chapters

class LMSCourse(Document):

    def validate(self):
        self.validate_instructors()
        self.validate_status()

    def validate_instructors(self):
        if self.is_new() and not self.instructors:
            frappe.get_doc({
                "doctype": "Course Instructor",
                "instructor": self.owner,
                "parent": self.name,
                "parentfield": "instructors",
                "parenttype": "LMS Course"
            }).save(ignore_permissions=True)

    def validate_status(self):
        if self.is_published:
            self.status = "Approved"

    def on_update(self):
        if not self.upcoming and self.has_value_changed("upcoming"):
            self.send_email_to_interested_users()

    def send_email_to_interested_users(self):
        interested_users = frappe.get_all("LMS Course Interest",
                                            {
                                                "course": self.name
                                            },
                                            ["name", "user"])
        subject = self.title + " is available!"
        args = {
            "title": self.title,
            "course_link": "/courses/{0}".format(self.name),
            "app_name": frappe.db.get_single_value("System Settings", "app_name"),
            "site_url": frappe.utils.get_url()
        }

        for user in interested_users:
            args["first_name"] = frappe.db.get_value("User", user.user, "first_name")
            email_args = frappe._dict(
                recipients = user.user,
                subject = subject,
                header = [subject, "green"],
                template = "lms_course_interest",
                args = args,
                now = True)
            frappe.enqueue(method=frappe.sendmail, queue='short', timeout=300, is_async=True, **email_args)
            frappe.db.set_value("LMS Course Interest", user.name, "email_sent", True)

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

    def get_cohorts(self):
        return find_all("Cohort", course=self.name, order_by="creation")

    def get_cohort(self, cohort_slug):
        name = frappe.get_value("Cohort", {"course": self.name, "slug": cohort_slug})
        return name and frappe.get_doc("Cohort", name)

    def reindex_exercises(self):
        for i, c in enumerate(get_chapters(self.name), start=1):
            self._reindex_exercises_in_chapter(c, i)

    def _reindex_exercises_in_chapter(self, c, index):
        i = 1
        for lesson in self.get_lessons(c):
            for exercise in lesson.get_exercises():
                exercise.index_ = i
                exercise.index_label = f"{index}.{i}"
                exercise.save()
                i += 1

    def get_all_memberships(self, member):
        all_memberships = frappe.get_all("LMS Batch Membership", {"member": member, "course": self.name}, ["batch"])
        for membership in all_memberships:
            membership.batch_title = frappe.db.get_value("LMS Batch", membership.batch, "title")
        return all_memberships

@frappe.whitelist()
def reindex_exercises(doc):
    course_data = json.loads(doc)
    course = frappe.get_doc("LMS Course", course_data['name'])
    course.reindex_exercises()
    frappe.msgprint("All exercises in this course have been re-indexed.")

@frappe.whitelist(allow_guest=True)
def search_course(text):
    search_courses = []
    courses = frappe.get_all("LMS Course",
                filters= {
                    "is_published": True
                },
                or_filters = {
                    "title": ["like", "%{0}%".format(text)],
                    "tags": ["like", "%{0}%".format(text)],
                    "short_introduction": ["like", "%{0}%".format(text)],
                    "description": ["like", "%{0}%".format(text)],
                })

    """ for course in courses:
        search_courses.append(frappe.get_doc("LMS Course", course)) """

    """ template = frappe.render_template("school/templates/course_list.html", {
        "title": _("Search Results"),
        "courses": search_courses,
        "widgets": Widgets()
    }) """

    return courses

@frappe.whitelist()
def submit_for_review(course):
    chapters = frappe.get_all("Chapter Reference", {"parent": course})
    if not len(chapters):
        return "No Chp"
    frappe.db.set_value("LMS Course", course, "status", "Ready for Review")
    return "OK"
