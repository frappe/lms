from unittest.mock import patch

import frappe

from lms.lms.api import get_announcements, send_batch_announcement
from lms.lms.test_helpers import BaseTestUtils
from lms.patches.v2_0 import mark_batch_announcements


# Guards a batch's announcements: only outgoing mail its own staff sent, shown
# only to its students and staff, and only what was sent as an announcement.
# Added for audit finding #693.
class TestBatchAnnouncementsScope(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		country_patch = patch("lms.lms.utils.get_country_code", return_value=None)
		country_patch.start()
		cls.addClassCleanup(country_patch.stop)

		hash = frappe.generate_hash(length=6)
		cls.instructor = cls._create_user(
			f"ann-instr-{hash}@example.com", "Ivy", "Instr", ["Course Creator"]
		).name
		cls.evaluator = cls._create_user(
			f"ann-eval-{hash}@example.com", "Eve", "Eval", ["Batch Evaluator"]
		).name
		cls.other_evaluator = cls._create_user(
			f"ann-oeval-{hash}@example.com", "Oz", "Eval", ["Batch Evaluator"]
		).name
		cls.other_creator = cls._create_user(
			f"ann-ocreator-{hash}@example.com", "Oc", "Creator", ["Course Creator"]
		).name
		cls.student = cls._create_user(f"ann-stud-{hash}@example.com", "Sam", "Stud", ["LMS Student"]).name
		cls.outsider = cls._create_user(f"ann-out-{hash}@example.com", "Out", "Sider", ["LMS Student"]).name
		cls._require_no_moderators(
			cls.instructor, cls.evaluator, cls.other_evaluator, cls.other_creator, cls.student, cls.outsider
		)

		course = cls._create_course(f"Announcements {hash}", instructor=cls.instructor).name
		cls._create_evaluator(cls.evaluator)
		cls.batch = cls._create_batch(
			course, instructor=cls.instructor, title=f"Announcements Batch {hash}", evaluator=cls.evaluator
		).name
		cls._create_batch_enrollment(cls.student, cls.batch)

		cls._mail("Real announcement", user=cls.instructor)
		cls._mail("Private reply", user=cls.instructor, sent_or_received="Received")
		cls._mail("Forged sender", user="Guest", sender=cls.instructor, sent_or_received="Received")
		cls._mail("Not staff of this batch", user=cls.other_creator)
		cls._mail("Automated", user=cls.instructor, communication_type="Automated Message")
		cls._mail("No sender account", user=None)
		cls._mail("Staff mail to one colleague", user=cls.instructor, announcement=0)

	@classmethod
	def _mail(cls, subject, user, announcement=1, **fields):
		doc = frappe.get_doc(
			{
				"doctype": "Communication",
				"subject": subject,
				"content": subject,
				"communication_type": "Communication",
				"communication_medium": "Email",
				"sent_or_received": "Sent",
				"sender": user,
				"recipients": cls.instructor,
				"reference_doctype": "LMS Batch",
				"reference_name": cls.batch,
				"lms_batch_announcement": announcement,
				"communication_date": frappe.utils.now_datetime(),
				**fields,
			}
		)
		doc.name = frappe.generate_hash(length=10)
		doc.user = user
		# Written straight to the table: the controller would send mail.
		doc.db_insert()

	def _subjects_as(self, user):
		frappe.set_user(user)
		try:
			return [row.subject for row in get_announcements(self.batch)]
		finally:
			frappe.set_user("Administrator")

	def test_only_mail_the_batchs_staff_sent_is_listed(self):
		for user in (self.student, self.instructor, self.evaluator, "Administrator"):
			with self.subTest(user=user):
				self.assertEqual(self._subjects_as(user), ["Real announcement"])

	def test_callers_outside_the_batch_are_refused(self):
		for user in (self.other_evaluator, self.other_creator, self.outsider, "Guest"):
			with self.subTest(user=user):
				with self.assertRaises(frappe.PermissionError):
					self._subjects_as(user)

	def test_the_sender_account_is_not_returned(self):
		frappe.set_user(self.student)
		try:
			rows = get_announcements(self.batch)
		finally:
			frappe.set_user("Administrator")
		self.assertNotIn("user", rows[0])

	def test_a_sent_announcement_is_listed(self):
		def make(**kwargs):
			"""Saves the Communication the real one would, without sending mail."""
			self._mail(kwargs["subject"], user=self.instructor, announcement=0)
			return {"name": frappe.db.get_value("Communication", {"subject": kwargs["subject"]}, "name")}

		frappe.set_user(self.instructor)
		try:
			with patch("frappe.core.doctype.communication.email.make", side_effect=make):
				send_batch_announcement(self.batch, "Sent through the form", "Body", self.instructor)
		finally:
			frappe.set_user("Administrator")

		self.assertIn("Sent through the form", self._subjects_as(self.student))

	def test_the_patch_marks_past_announcements_only(self):
		self._mail("Past announcement", user=self.instructor, announcement=0, bcc=self.student)
		self._mail("Past private mail", user=self.instructor, announcement=0)
		self._mail("Past mail from outside", user=self.other_creator, announcement=0, bcc=self.student)
		self._mail("Past mail to a colleague", user=self.instructor, announcement=0, bcc=self.evaluator)

		# Sent to one of two students, then the other left: still not a broadcast.
		leaver = self._create_user(
			f"ann-leaver-{frappe.generate_hash(length=6)}@example.com", "Lee", "Ver", ["LMS Student"]
		).name
		self._create_batch_enrollment(leaver, self.batch)
		self._mail("Past mail to one student", user=self.instructor, announcement=0, bcc=self.student)
		frappe.delete_doc(
			"LMS Batch Enrollment",
			frappe.db.get_value("LMS Batch Enrollment", {"batch": self.batch, "member": leaver}),
			ignore_permissions=True,
		)

		mark_batch_announcements.execute()

		subjects = self._subjects_as(self.student)
		self.assertIn("Past announcement", subjects)
		self.assertNotIn("Past private mail", subjects)
		self.assertNotIn("Past mail from outside", subjects)
		self.assertNotIn("Past mail to a colleague", subjects)
		self.assertNotIn("Past mail to one student", subjects)
