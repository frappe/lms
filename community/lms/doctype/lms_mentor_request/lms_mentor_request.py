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
			template = frappe.db.get_single_value('LMS Settings', 'mentor_request_status_update')
			if not template:
				return

			email_template = frappe.get_doc('Email Template', template)	
			message = frappe.render_template(email_template.response, {'member_name': self.member_name, 'status': self.status})
			subject = _('The status of your application has changed.')
			member_email = frappe.db.get_value("Community Member", self.member, "email")
			
			if self.status == 'Approved' or self.status == 'Rejected':
				reviewed_by = frappe.db.get_value('Community Member', self.reviewed_by, 'email')
				send_email(member_email, [get_course_author(self.course), reviewed_by], subject, message)
			
			elif self.status == 'Withdrawn':
				send_email([member_email, get_course_author(self.course)], None, subject, message)

@frappe.whitelist()
def has_requested(course):
	return len(frappe.get_all('LMS Mentor Request',
					filters = {
						'member': get_member().name,
						'course': course,
						'status': ['in', ('Pending', 'Approved')]
					}
				)
			)

@frappe.whitelist()
def create_request(course):
	if not has_requested(course):
		member = get_member()
		frappe.get_doc({
			'doctype': 'LMS Mentor Request',
			'member': member.name,
			'course': course,
			'status': 'Pending'
		}).save(ignore_permissions=True)
		send_creation_email(course, member)
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

def get_course_author(course):
	return frappe.db.get_value('LMS Course', course, 'owner')

def send_creation_email(course, member):
	template = frappe.db.get_single_value('LMS Settings', 'mentor_request_creation')
	if not template:
		return

	email_template = frappe.get_doc('Email Template', template)
	member_name = member.full_name
	message = frappe.render_template(email_template.response, {'member_name': member_name})
	subject = _('Request for Mentorship')
	send_email([frappe.session.user, get_course_author(course)], None, subject, message)

def send_email(recipients, cc=None, subject=None, message=None, template=None, args=None):
	frappe.sendmail(
		recipients = recipients,
		cc = cc,
		sender = frappe.db.get_single_value('LMS Settings', 'email_sender'),
		subject = subject, 
		send_priority = 0, 
		queue_separately = True,
		message = message,
		template=template,
		args=args
	)