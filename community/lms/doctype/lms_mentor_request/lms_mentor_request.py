# -*- coding: utf-8 -*-
# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from frappe import _

class LMSMentorRequest(Document):
    def on_update(self):
        if self.has_value_changed('status'):

            if self.status == "Approved":
                self.create_course_mentor_mapping()

            if self.status != "Pending":
                self.send_status_change_email()

    def create_course_mentor_mapping(self):
        mapping = frappe.get_doc({
            "doctype": "LMS Course Mentor Mapping",
            "mentor": self.member,
            "course": self.course
        })
        mapping.save()

    def send_creation_email(self, member):
        email_template = self.get_email_template('mentor_request_creation')
        if not email_template:
            return

        course_details = frappe.db.get_value("LMS Course", self.course, ["owner", "slug", "title"], as_dict=True)
        message = frappe.render_template(email_template.response,
                {
                    'member_name': member.full_name,
                    'course_url': '/courses/' + course_details.slug,
                    'course': course_details.title
                })

        email_args = {
            "recipients": [frappe.session.user, course_details.owner],
            "subject": email_template.subject,
            "header": email_template.subject,
            "message": message
        }
        frappe.enqueue(method=frappe.sendmail, queue="short", timeout=300, is_async=True, **email_args)

    def send_status_change_email(self):
        email_template = self.get_email_template('mentor_request_status_update')
        if not email_template:
            return

        course_details = frappe.db.get_value("LMS Course", self.course, ["owner", "title"], as_dict=True)
        message = frappe.render_template(email_template.response,
                {
                    'member_name': self.member_name,
                    'status': self.status,
                    'course': course_details.title
                })

        member_email = frappe.db.get_value("Community Member", self.member, "email")
        if self.status == 'Approved' or self.status == 'Rejected':
            reviewed_by = frappe.db.get_value('Community Member', self.reviewed_by, 'email')
            email_args = {
                "recipients": member_email,
                "cc": [course_details.owner, reviewed_by],
                "subject": email_template.subject,
                "header": email_template.subject,
                "message": message
            }
            frappe.enqueue(method=frappe.sendmail, queue="short", timeout=300, is_async=True, **email_args)

        elif self.status == 'Withdrawn':
            email_args = {
                "recipients": [member_email, course_details.owner],
                "subject": email_template.subject,
                "header": email_template.subject,
                "message": message
            }
            frappe.enqueue(method=frappe.sendmail, queue="short", timeout=300, is_async=True, **email_args)

    def get_email_template(self, template_name):
        template = frappe.db.get_single_value('LMS Settings', template_name)
        if template:
            return frappe.get_doc('Email Template', template)

@frappe.whitelist()
def has_requested(course):
    return frappe.db.count('LMS Mentor Request',
                filters = {
                    'member': get_member().name,
                    'course': course,
                    'status': ['in', ('Pending', 'Approved')]
                }
			)

@frappe.whitelist()
def create_request(course):
    if not has_requested(course):
        member = get_member()
        request = frappe.get_doc({
                    'doctype': 'LMS Mentor Request',
                    'member': member.name,
                    'course': course,
                    'status': 'Pending'
                })
        request.save(ignore_permissions=True)
        request.send_creation_email(member)
        return 'OK'

    else:
        return 'Already Applied'

@frappe.whitelist()
def cancel_request(course):
    request = frappe.get_doc('LMS Mentor Request', {'member': get_member().name, 'course': course, 'status': ['in', ('Pending', 'Approved')]})
    request.status = 'Withdrawn'
    request.save(ignore_permissions=True)
    return 'OK'

def get_member():
    try:
        return frappe.get_doc('Community Member', {'email': frappe.session.user})
    except frappe.DoesNotExistError:
        return
