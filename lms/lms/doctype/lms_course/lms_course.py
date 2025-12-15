# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

import json
import random

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, today

from ...utils import generate_slug, update_payment_record, validate_image


class LMSCourse(Document):
	def validate(self):
		self.validate_published()
		self.validate_instructors()
		self.validate_video_link()
		self.validate_status()
		self.validate_payments_app()
		self.validate_certification()
		self.validate_amount_and_currency()
		self.image = validate_image(self.image)
		self.validate_card_gradient()

	def validate_published(self):
		if self.published and not self.published_on:
			self.published_on = today()

	def validate_instructors(self):
		if self.is_new() and not self.instructors:
			frappe.get_doc(
				{
					"doctype": "Course Instructor",
					"instructor": self.owner,
					"parent": self.name,
					"parentfield": "instructors",
					"parenttype": "LMS Course",
				}
			).save(ignore_permissions=True)

	def validate_video_link(self):
		if self.video_link and "/" in self.video_link:
			self.video_link = self.video_link.split("/")[-1]

	def validate_status(self):
		if self.published:
			self.status = "Approved"

	def validate_payments_app(self):
		if self.paid_course:
			installed_apps = frappe.get_installed_apps()
			if "payments" not in installed_apps:
				documentation_link = "https://docs.frappe.io/learning/setting-up-payment-gateway"
				frappe.throw(
					_(
						"Please install the Payments App to create a paid course. Refer to the documentation for more details. {0}"
					).format(documentation_link)
				)

	def validate_certification(self):
		if self.enable_certification and self.paid_certificate:
			frappe.throw(_("A course cannot have both paid certificate and certificate of completion."))

		if self.paid_certificate and not self.evaluator:
			frappe.throw(_("Evaluator is required for paid certificates."))

		if self.paid_certificate and not self.timezone:
			frappe.throw(_("Timezone is required for paid certificates."))

	def validate_amount_and_currency(self):
		if self.paid_course and (cint(self.course_price) < 0 or not self.currency):
			frappe.throw(_("Amount and currency are required for paid courses."))

		if self.paid_certificate and (cint(self.course_price) <= 0 or not self.currency):
			frappe.throw(_("Amount and currency are required for paid certificates."))

	def validate_card_gradient(self):
		if not self.image and not self.card_gradient:
			colors = [
				"Red",
				"Blue",
				"Green",
				"Yellow",
				"Orange",
				"Pink",
				"Amber",
				"Violet",
				"Cyan",
				"Teal",
				"Gray",
				"Purple",
			]
			self.card_gradient = random.choice(colors)

	def on_update(self):
		if not self.upcoming and self.has_value_changed("upcoming"):
			self.send_email_to_interested_users()

	def on_payment_authorized(self, payment_status):
		if payment_status in ["Authorized", "Completed"]:
			update_payment_record("LMS Course", self.name)

	def send_email_to_interested_users(self):
		interested_users = frappe.get_all("LMS Course Interest", {"course": self.name}, ["name", "user"])
		subject = self.title + " is available!"
		args = {
			"title": self.title,
			"course_link": f"/lms/courses/{self.name}",
			"app_name": frappe.db.get_single_value("System Settings", "app_name"),
			"site_url": frappe.utils.get_url(),
		}

		for user in interested_users:
			args["first_name"] = frappe.db.get_value("User", user.user, "first_name")
			email_args = frappe._dict(
				recipients=user.user,
				subject=subject,
				header=[subject, "green"],
				template="lms_course_interest",
				args=args,
				now=True,
			)
			frappe.enqueue(method=frappe.sendmail, queue="short", timeout=300, is_async=True, **email_args)
			frappe.db.set_value("LMS Course Interest", user.name, "email_sent", True)

	def autoname(self):
		if not self.name:
			self.name = generate_slug(self.title, "LMS Course")

	def __repr__(self):
		return f"<Course#{self.name}>"
