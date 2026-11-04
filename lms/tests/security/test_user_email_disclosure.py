# Copyright (c) 2026, Frappe and Contributors
# See license.txt
"""A User's name is their login email. No caller, staff included, gets another user's:
they get username, full name and image instead. A user always sees their own."""

import json
from unittest.mock import patch

import frappe
from frappe.utils import add_days, nowdate

from lms.lms import api
from lms.lms.api import (
	get_admin_live_classes,
	get_announcements,
	get_badges,
	get_job_details,
	get_my_live_classes,
	get_profile_details,
)
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import (
	get_batch_courses,
	get_batch_details,
	get_batch_student_progress,
	get_batches,
	get_course_details,
	get_courses,
	get_discussion_replies,
	get_lesson,
	get_related_courses,
	get_reviews,
)


class TestUserEmailDisclosure(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.hash = hash

		frappe.db.set_single_value("LMS Settings", "allow_guest_access", 1)
		frappe.clear_document_cache("LMS Settings", "LMS Settings")
		country_patch = patch("lms.lms.utils.get_country_code", return_value=None)
		country_patch.start()
		cls.addClassCleanup(country_patch.stop)

		cls.instructor = cls._create_user(
			f"ued-instr-{hash}@example.com", "Ivy", "Instr", ["Course Creator"]
		).name
		cls.evaluator = cls._create_user(
			f"ued-eval-{hash}@example.com", "Eve", "Eval", ["Batch Evaluator"]
		).name
		cls.moderator = cls._create_user(f"ued-mod-{hash}@example.com", "Mo", "Derator", ["Moderator"]).name
		cls.system_manager = cls._create_user(
			f"ued-sm-{hash}@example.com", "Sys", "Man", ["System Manager"], user_type="System User"
		).name
		cls.student = cls._create_user(f"ued-stud-{hash}@example.com", "Sam", "Stud", ["LMS Student"]).name
		cls.other = cls._create_user(f"ued-other-{hash}@example.com", "Ola", "Other", ["LMS Student"]).name
		cls.other_username = frappe.db.get_value("User", cls.other, "username")

		cls.course = cls._create_course(f"Email Disclosure {hash}", instructor=cls.instructor).name
		related = cls._create_course(f"Email Disclosure Related {hash}", instructor=cls.instructor).name
		frappe.get_doc(
			{
				"doctype": "Related Courses",
				"parent": cls.course,
				"parenttype": "LMS Course",
				"parentfield": "related_courses",
				"course": related,
			}
		).insert()
		chapter = cls._create_chapter(f"Chapter {hash}", cls.course).name
		cls.lesson = cls._create_lesson(f"Lesson {hash}", chapter, cls.course).name
		cls._create_chapter_reference(cls.course, chapter)
		cls._create_lesson_reference(chapter, cls.lesson)
		cls._create_enrollment(cls.student, cls.course)
		cls._create_enrollment(cls.other, cls.course)
		cls._add_rating(cls.course, cls.other, 0.8, "Good course")

		cls._create_evaluator(cls.evaluator)
		cls.batch = cls._create_batch(
			cls.course,
			instructor=cls.instructor,
			title=f"Email Disclosure Batch {hash}",
			evaluator=cls.evaluator,
		).name
		cls._create_batch_enrollment(cls.student, cls.batch)
		cls._create_batch_enrollment(cls.other, cls.batch)

		cls.job = cls._insert_raw(
			"Job Opportunity",
			owner=cls.other,
			job_title=f"Job {hash}",
			location="Remote",
			country="India",
			type="Full Time",
			work_mode="Remote",
			status="Open",
			description="A job",
			company_name="Acme",
			company_website="https://example.com",
			company_logo="/files/logo.png",
			company_email_address="jobs@example.com",
		)
		cls.topic = cls._insert_raw(
			"Discussion Topic",
			owner=cls.other,
			title=f"Topic {hash}",
			reference_doctype="LMS Batch",
			reference_docname=cls.batch,
		)
		cls._insert_raw("Discussion Reply", owner=cls.other, topic=cls.topic, reply="A question")
		cls._insert_raw(
			"Communication",
			subject="Hello",
			content="Welcome",
			communication_type="Communication",
			communication_medium="Email",
			sent_or_received="Sent",
			sender=cls.instructor,
			sender_full_name="Ivy Instr",
			recipients=cls.instructor,
			cc=cls.other,
			reference_doctype="LMS Batch",
			reference_name=cls.batch,
		)
		cls._insert_raw(
			"LMS Live Class",
			owner=cls.moderator,
			title="Live",
			date=add_days(nowdate(), 1),
			time="10:00:00",
			duration=30,
			timezone="Asia/Kolkata",
			host=cls.instructor,
			batch_name=cls.batch,
		)
		frappe.get_doc(
			{
				"doctype": "Course Instructor",
				"parent": cls.batch,
				"parenttype": "LMS Batch",
				"parentfield": "instructors",
				"instructor": cls.moderator,
				"idx": 2,
			}
		).insert()
		cls._insert_raw(
			"LMS Badge Assignment",
			member=cls.other,
			badge=f"Badge {hash}",
			issued_on=nowdate(),
			badge_image="/files/badge.png",
			badge_description="A badge",
		)
		cls._insert_raw(
			"Notification Log",
			subject="Hello",
			for_user=cls.student,
			from_user=cls.other,
			type="Alert",
		)
		cls._insert_raw(
			"LMS Certificate Request",
			course=cls.course,
			member=cls.other,
			member_name="Ola Other",
			evaluator=cls.evaluator,
			date=add_days(nowdate(), 2),
			start_time="10:00:00",
			end_time="11:00:00",
			status="Upcoming",
		)
		cls.application = cls._insert_raw(
			"LMS Job Application", owner=cls.student, user=cls.student, job=cls.job
		)
		frappe.share.add_docshare(
			"LMS Job Application", cls.application, cls.other, read=1, flags={"ignore_share_permission": 1}
		)
		cls.certificate = cls._insert_raw(
			"LMS Certificate",
			member=cls.other,
			course=cls.course,
			issue_date=nowdate(),
			published=1,
			template="Certificate",
		)

	@classmethod
	def _insert_raw(cls, doctype, owner="Administrator", **fields):
		"""Fixture rows written straight to the table: their controllers call out
		to calendars and mail, none of which is what this suite is about."""
		doc = frappe.get_doc({"doctype": doctype, **fields})
		doc.name = frappe.generate_hash(length=10)
		doc.db_insert()
		# Frappe stamps the session user as owner on insert, whatever the doc says.
		frappe.db.set_value(doctype, doc.name, "owner", owner, update_modified=False)
		return doc.name

	def _as(self, user, fn):
		frappe.set_user(user)
		try:
			return fn()
		finally:
			frappe.set_user("Administrator")

	def _payload(self, user, fn):
		return json.dumps(self._as(user, fn), default=str)

	def _endpoints(self):
		return {
			"get_course_details": lambda: get_course_details(self.course),
			"get_courses": lambda: get_courses(limit_page_length=500),
			"get_related_courses": lambda: get_related_courses(self.course),
			"get_batch_details": lambda: get_batch_details(self.batch),
			"get_batch_courses": lambda: get_batch_courses(self.batch),
			"get_batches": lambda: get_batches(limit_page_length=500),
			"get_reviews": lambda: get_reviews(self.course),
			"get_job_details": lambda: get_job_details(self.job),
			"get_lesson": lambda: get_lesson(self.course, 1, 1),
			"get_profile_details": lambda: get_profile_details(self.other_username),
			"get_badges": lambda: get_badges(self.other_username),
			"get_user_certificates": lambda: api.get_user_certificates(self.other_username),
			"get_discussion_replies": lambda: get_discussion_replies(self.topic),
			"get_announcements": lambda: get_announcements(self.batch),
			"get_my_live_classes": get_my_live_classes,
			"get_admin_live_classes": get_admin_live_classes,
			"get_admin_evals": api.get_admin_evals,
			"get_notifications": api.get_notifications,
			"get_application_users": lambda: api.get_application_users([self.application]),
			"get_batch_student_progress": lambda: get_batch_student_progress(self.other_username, self.batch),
			"get_certification_details": lambda: api.get_certification_details(self.course),
			"get_all_users": lambda: api.get_all_users("LMS Batch", self.batch),
		}

	def _callers(self):
		return {
			"guest": "Guest",
			"student": self.student,
			"other_student": self.other,
			"course_creator": self.instructor,
			"batch_evaluator": self.evaluator,
			"moderator": self.moderator,
			"system_manager": self.system_manager,
			"administrator": "Administrator",
		}

	def test_no_caller_gets_another_users_email(self):
		"""Regression from #316 (instructors, reviews), #713 (job poster) and #1824 (profiles).
		Added for audit findings #37, #38, #77 and #87 on branch fix/hide-user-emails."""
		emails = {
			self.student,
			self.other,
			self.instructor,
			self.evaluator,
			self.moderator,
			self.system_manager,
		}
		for kind, caller in self._callers().items():
			for name, fn in self._endpoints().items():
				with self.subTest(caller=kind, endpoint=name):
					try:
						payload = self._payload(caller, fn)
					except (frappe.PermissionError, frappe.ValidationError):
						# Some refusals raise a plain ValidationError; a refusal carries no payload.
						continue
					for email in emails - {caller}:
						self.assertNotIn(email, payload)

	def test_the_response_shape_is_the_same_for_every_role(self):
		def keys(caller):
			course = self._as(caller, lambda: get_course_details(self.course))
			batch = self._as(caller, lambda: get_batch_details(self.batch))
			return (set(course["instructors"][0]), set(batch["courses"][0]), set(batch) - {"can_manage"})

		guest = keys("Guest")
		for kind in ("student", "moderator", "system_manager", "administrator"):
			with self.subTest(caller=kind):
				self.assertEqual(keys(self._callers()[kind]), guest)

	def test_instructors_keep_their_public_identity(self):
		"""Regression as old as the app (#316): instructor rows carried the login email.
		Added for audit finding #87 on branch fix/hide-user-emails."""
		course = self._as(self.moderator, lambda: get_course_details(self.course))
		self.assertEqual(len(course["instructors"]), 1)
		row = course["instructors"][0]
		self.assertNotIn("name", row)
		self.assertEqual(row["username"], frappe.db.get_value("User", self.instructor, "username"))
		self.assertEqual(row["full_name"], "Ivy Instr")

	def test_batch_details_count_students_instead_of_listing_them(self):
		"""Regression from #1311: get_batch_details listed the students' emails.
		Added with audit finding #87 on branch fix/hide-user-emails."""
		for caller, is_student in ((self.moderator, False), (self.student, True)):
			with self.subTest(caller=caller):
				batch = self._as(caller, lambda: get_batch_details(self.batch))
				self.assertNotIn("students", batch)
				self.assertEqual(batch["student_count"], 2)
				self.assertEqual(batch["is_student"], is_student)
				self.assertEqual([course["has_evaluator"] for course in batch["courses"]], [True])
				self.assertNotIn("evaluator", batch["courses"][0])

	def test_profile_resolves_by_username_without_the_email(self):
		"""Regression from #1824: get_profile_details mapped a username to the login email.
		Added for audit finding #37 on branch fix/hide-user-emails."""
		details = self._as(self.moderator, lambda: get_profile_details(self.other_username))
		self.assertNotIn("name", details)
		self.assertEqual(details["username"], self.other_username)
		self.assertEqual(details["full_name"], "Ola Other")

	def test_badges_and_certificates_resolve_a_username(self):
		badges = self._as(self.student, lambda: get_badges(self.other_username))
		self.assertEqual([badge["badge"] for badge in badges], [f"Badge {self.hash}"])
		certificates = self._as(self.student, lambda: api.get_user_certificates(self.other_username))
		self.assertEqual([row["name"] for row in certificates], [self.certificate])

	def test_student_progress_is_looked_up_by_username(self):
		details = self._as(
			self.evaluator, lambda: get_batch_student_progress(self.other_username, self.batch)
		)
		self.assertEqual(details["username"], self.other_username)
		self.assertEqual(details["full_name"], "Ola Other")
		self.assertNotIn("email", details)
		self.assertNotIn("name", details)

	def test_student_progress_is_looked_up_by_enrollment(self):
		"""member_username is copied onto the enrollment when it is saved, so a
		renamed user leaves it stale; the enrollment's name does not change."""
		enrollment = frappe.db.get_value("LMS Batch Enrollment", {"batch": self.batch, "member": self.other})
		frappe.db.set_value(
			"LMS Batch Enrollment",
			enrollment,
			"member_username",
			f"renamed-{self.hash}",
			update_modified=False,
		)
		self.addCleanup(
			frappe.db.set_value,
			"LMS Batch Enrollment",
			enrollment,
			"member_username",
			self.other_username,
			update_modified=False,
		)
		details = self._as(self.evaluator, lambda: get_batch_student_progress(enrollment, self.batch))
		self.assertEqual(details["username"], self.other_username)
		self.assertNotIn("name", details)

	def test_applicants_are_keyed_by_application(self):
		rows = self._as(self.other, lambda: api.get_application_users([self.application]))
		self.assertEqual(len(rows), 1)
		self.assertEqual(rows[0]["application"], self.application)
		self.assertEqual(rows[0]["full_name"], "Sam Stud")
		self.assertNotIn("name", rows[0])
		self.assertNotIn("email", rows[0])

	def test_notifications_keep_the_senders_display_details(self):
		rows = self._as(self.student, api.get_notifications)
		self.assertEqual([row["from_user_details"]["full_name"] for row in rows], ["Ola Other"])
		self.assertNotIn("from_user", rows[0])

	def test_reviews_keep_the_reviewer_display_details(self):
		reviews = self._as("Guest", lambda: get_reviews(self.course))
		self.assertEqual(len(reviews), 1)
		self.assertNotIn("owner", reviews[0])
		self.assertEqual(reviews[0]["owner_details"]["full_name"], "Ola Other")

	def test_get_user_certificates_rejects_a_non_string(self):
		# The whitelist's own coercion answers first; __wrapped__ reaches the guard behind it.
		unwrapped = getattr(api.get_user_certificates, "__wrapped__", api.get_user_certificates)
		with self.assertRaises(frappe.ValidationError):
			self._as(self.student, lambda: unwrapped(["like", "%"]))

	def test_job_poster_emails_an_applicant_without_their_address(self):
		for poster in (self.other, self.moderator):
			with self.subTest(poster=poster), patch("frappe.core.doctype.communication.email.make") as make:
				self._as(poster, lambda: api.send_job_application_email(self.application, "Hi", "Body"))
				self.assertEqual(make.call_args.kwargs["recipients"], self.student)
				self.assertEqual(make.call_args.kwargs["name"], self.application)
				# Nobody is copied in: the poster's address is the sender's own.
				self.assertNotIn("cc", make.call_args.kwargs)
				self.assertNotIn("bcc", make.call_args.kwargs)

	def test_only_the_jobs_poster_can_email_the_applicant(self):
		outsider = self._create_user(
			f"ued-outsider-{self.hash}@example.com", "Out", "Sider", ["LMS Student"]
		).name
		# The applicant reads their own application; that is not enough.
		for caller in (self.student, outsider):
			with self.subTest(caller=caller), patch("frappe.core.doctype.communication.email.make") as make:
				with self.assertRaises(frappe.PermissionError):
					self._as(caller, lambda: api.send_job_application_email(self.application, "Hi", "Body"))
				make.assert_not_called()

	def test_mentionable_people_are_the_contexts_members_and_staff_by_username(self):
		def usernames(*users):
			return {frappe.db.get_value("User", user, "username") for user in users}

		batch_people = self._as(self.instructor, lambda: api.get_all_users("LMS Batch", self.batch))
		self.assertEqual(
			set(batch_people),
			usernames(self.student, self.other, self.instructor, self.moderator, self.evaluator),
		)
		lesson_people = self._as(self.moderator, lambda: api.get_all_users("Course Lesson", self.lesson))
		self.assertEqual(set(lesson_people), usernames(self.student, self.other, self.instructor))
		for person in (*batch_people.values(), *lesson_people.values()):
			self.assertEqual(set(person), {"username", "full_name", "user_image"})
		self.assertEqual(self._as(self.moderator, lambda: api.get_all_users("LMS Course", self.course)), {})

	def test_mentions_are_refused_outside_the_callers_courses_and_batches(self):
		bystander = self._create_user(
			f"ued-bystander-{self.hash}@example.com", "By", "Stander", ["Course Creator"]
		).name
		for caller in (self.student, bystander):
			for doctype, docname in (("LMS Batch", self.batch), ("Course Lesson", self.lesson)):
				with self.subTest(caller=caller, doctype=doctype), self.assertRaises(frappe.PermissionError):
					self._as(caller, lambda: api.get_all_users(doctype, docname))

	def test_announcement_bccs_the_students_on_the_server(self):
		with patch("frappe.core.doctype.communication.email.make") as make:
			self._as(
				self.moderator,
				lambda: api.send_batch_announcement(self.batch, "Hi", "Body", "reply@example.com"),
			)
		bcc = set(make.call_args.kwargs["bcc"].split(", "))
		self.assertEqual(bcc, {self.student, self.other})
		self.assertEqual(make.call_args.kwargs["recipients"], "reply@example.com")

	def test_a_student_cannot_send_an_announcement(self):
		with patch("frappe.core.doctype.communication.email.make") as make:
			with self.assertRaises(frappe.PermissionError):
				self._as(
					self.student, lambda: api.send_batch_announcement(self.batch, "Hi", "Body", "r@x.com")
				)
		make.assert_not_called()

	def test_bulk_certificates_cover_every_student_and_report_failures(self):
		details = {"issue_date": nowdate(), "template": "Certificate", "published": 1}
		first = self._as(self.moderator, lambda: api.generate_batch_certificates(self.batch, details))
		self.assertEqual(first, {"created": 2, "errors": []})
		self.assertEqual(
			set(frappe.get_all("LMS Certificate", {"batch_name": self.batch}, pluck="member")),
			{self.student, self.other},
		)
		again = self._as(self.moderator, lambda: api.generate_batch_certificates(self.batch, details))
		self.assertEqual(again["created"], 0)
		self.assertEqual(len(again["errors"]), 2)
		for message in again["errors"]:
			self.assertNotIn("@example.com", message)

	def test_a_student_cannot_generate_certificates(self):
		result = self._as(
			self.student,
			lambda: api.generate_batch_certificates(self.batch, {"issue_date": nowdate()}),
		)
		self.assertEqual(result["created"], 0)
		self.assertFalse(frappe.db.exists("LMS Certificate", {"batch_name": self.batch}))

	def test_user_sees_own_email(self):
		self.assertEqual(
			self._as(self.other, lambda: get_profile_details(self.other_username))["name"], self.other
		)
		self.assertEqual(self._as(self.other, lambda: get_job_details(self.job))["owner"], self.other)
		replies = self._as(self.other, lambda: get_discussion_replies(self.topic))
		self.assertEqual([reply["owner"] for reply in replies], [self.other])
		reviews = self._as(self.other, lambda: get_reviews(self.course))
		self.assertEqual([review["owner"] for review in reviews], [self.other])
		course = self._as(self.instructor, lambda: get_course_details(self.course))
		self.assertEqual([row["name"] for row in course["instructors"]], [self.instructor])
		evals = self._as(self.evaluator, api.get_admin_evals)
		self.assertEqual([row["evaluator"] for row in evals], [self.evaluator])
