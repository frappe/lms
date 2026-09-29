# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""The Batch Evaluator role grants batch authoring; the batch's own tags decide which batch.

Every check passes the document: frappe.has_permission without one never reaches the
has_permission hook.
"""

from unittest.mock import patch

import frappe
from frappe.client import set_value
from frappe.utils import nowdate

from lms.lms.doctype.lms_batch import lms_batch
from lms.lms.test_helpers import BaseTestUtils

AUTHORING = ("write", "delete")


class TestBatchAuthoringScope(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		hash = frappe.generate_hash(length=6)
		cls.instructor = cls._create_user(f"bas-inst-{hash}@example.com", "Ina", "Instr", ["Batch Evaluator"])
		cls.evaluator = cls._create_user(f"bas-eval-{hash}@example.com", "Eva", "Eval", ["Batch Evaluator"])
		cls.outsider = cls._create_user(f"bas-out-{hash}@example.com", "Otto", "Out", ["Batch Evaluator"])
		cls.moderator = cls._create_user(f"bas-mod-{hash}@example.com", "Mia", "Mod", ["Moderator"])
		cls.student = cls._create_user(f"bas-stu-{hash}@example.com", "Sam", "Stu", ["LMS Student"])
		cls.course_author = cls._create_user(
			f"bas-ca-{hash}@example.com", "Cai", "Author", ["Course Creator"]
		)
		cls.system_manager = cls._create_user(
			f"bas-sm-{hash}@example.com", "Sy", "Manager", ["System Manager"], user_type="System User"
		)

		cls._create_evaluator(cls.evaluator.name)
		course = cls._create_course(title=f"BAS Course {hash}", instructor=cls.course_author.name).name
		cls.batch = cls._create_batch(
			course=course,
			instructor=cls.instructor.name,
			title=f"BAS Batch {hash}",
			evaluator=cls.evaluator.name,
		).name
		cls.outsider_batch = cls._create_batch(
			course=course,
			instructor=cls.outsider.name,
			title=f"BAS Outsider Batch {hash}",
			evaluator=cls.evaluator.name,
		).name
		# Tagged as an instructor, but Course Creator has no LMS Live Class create DocPerm.
		cls.no_create_perm_batch = cls._create_batch(
			course=course,
			instructor=cls.course_author.name,
			title=f"BAS No-Create-Perm Batch {hash}",
			evaluator=cls.evaluator.name,
		).name
		cls.live_class = cls._live_class(cls.batch)

	@classmethod
	def _live_class(cls, batch):
		# db_insert: validate() calls out to the conferencing provider.
		doc = frappe.get_doc(
			{
				"doctype": "LMS Live Class",
				"batch_name": batch,
				"title": f"BAS Class {frappe.generate_hash(length=6)}",
				"date": nowdate(),
				"time": "10:00:00",
				"duration": 60,
				"timezone": "Asia/Kolkata",
				"host": "Administrator",
			}
		)
		doc.set_new_name()
		doc.db_insert()
		return doc.name

	def _can(self, user, doctype, name, ptype):
		return frappe.has_permission(doctype, ptype, doc=frappe.get_doc(doctype, name), user=user)

	def test_an_untagged_evaluator_cannot_author_a_batch(self):
		for ptype in AUTHORING:
			with self.subTest(ptype=ptype):
				self.assertFalse(self._can(self.outsider.name, "LMS Batch", self.batch, ptype))

	def test_an_untagged_evaluator_cannot_retitle_a_batch_through_the_generic_api(self):
		frappe.set_user(self.outsider.name)
		with self.assertRaises(frappe.PermissionError):
			set_value("LMS Batch", self.batch, "title", "Taken over")

		frappe.set_user("Administrator")
		self.assertNotEqual(frappe.db.get_value("LMS Batch", self.batch, "title"), "Taken over")

	def test_adding_yourself_as_instructor_does_not_authorise_the_save(self):
		frappe.set_user(self.outsider.name)
		batch = frappe.get_doc("LMS Batch", self.batch)
		batch.append("instructors", {"instructor": self.outsider.name})
		with self.assertRaises(frappe.PermissionError):
			batch.save()

	def test_tagged_users_and_moderators_can_author_a_batch(self):
		for user in (self.instructor.name, self.evaluator.name, self.moderator.name):
			for ptype in AUTHORING:
				with self.subTest(user=user, ptype=ptype):
					self.assertTrue(self._can(user, "LMS Batch", self.batch, ptype))

	def test_an_untagged_evaluator_keeps_read(self):
		frappe.db.set_value("LMS Batch", self.batch, "published", 0)
		self.assertTrue(self._can(self.outsider.name, "LMS Batch", self.batch, "read"))
		self.assertTrue(self._can(self.outsider.name, "LMS Live Class", self.live_class, "read"))

	def test_students_and_guests_cannot_author_a_batch(self):
		for user in (self.student.name, "Guest"):
			with self.subTest(user=user):
				self.assertFalse(self._can(user, "LMS Batch", self.batch, "write"))

	def test_an_untagged_evaluator_cannot_author_a_live_class(self):
		for ptype in AUTHORING:
			with self.subTest(ptype=ptype):
				self.assertFalse(self._can(self.outsider.name, "LMS Live Class", self.live_class, ptype))

	def test_tagged_users_can_author_a_live_class(self):
		for user in (self.instructor.name, self.evaluator.name, self.moderator.name):
			with self.subTest(user=user):
				self.assertTrue(self._can(user, "LMS Live Class", self.live_class, "write"))

	def test_a_live_class_cannot_be_moved_out_of_a_batch_you_do_not_author(self):
		doc = frappe.get_doc("LMS Live Class", self.live_class)
		doc.batch_name = self.outsider_batch
		self.assertFalse(frappe.has_permission("LMS Live Class", "write", doc=doc, user=self.outsider.name))

	def test_a_live_class_cannot_be_moved_into_a_batch_you_do_not_author(self):
		doc = frappe.get_doc("LMS Live Class", self.live_class)
		doc.batch_name = self.outsider_batch
		self.assertFalse(frappe.has_permission("LMS Live Class", "write", doc=doc, user=self.instructor.name))

	def test_a_live_class_can_be_created_in_a_batch_you_author(self):
		doc = frappe.new_doc("LMS Live Class")
		doc.batch_name = self.batch
		self.assertTrue(frappe.has_permission("LMS Live Class", "create", doc=doc, user=self.instructor.name))
		self.assertFalse(frappe.has_permission("LMS Live Class", "create", doc=doc, user=self.outsider.name))

	def test_a_deleted_batch_does_not_authorise_its_old_instructor(self):
		gone = self._create_batch(
			course=frappe.db.get_value("Batch Course", {"parent": self.batch}, "course"),
			instructor=self.instructor.name,
			title=f"BAS Gone Batch {frappe.generate_hash(length=6)}",
			evaluator=self.evaluator.name,
		)
		live_class = self._live_class(gone.name)
		# Leaves the Course Instructor / Batch Course rows behind as orphans.
		frappe.db.delete("LMS Batch", gone.name)

		self.assertFalse(self._can(self.instructor.name, "LMS Live Class", live_class, "write"))

	def test_a_bare_system_manager_keeps_batch_and_live_class_access(self):
		for ptype in AUTHORING:
			with self.subTest(ptype=ptype):
				self.assertTrue(self._can(self.system_manager.name, "LMS Batch", self.batch, ptype))
				self.assertTrue(self._can(self.system_manager.name, "LMS Live Class", self.live_class, ptype))

	def test_an_evaluator_can_create_a_batch(self):
		doc = frappe.new_doc("LMS Batch")
		self.assertTrue(frappe.has_permission("LMS Batch", "create", doc=doc, user=self.outsider.name))

	def test_an_untagged_evaluator_cannot_create_a_zoom_class_before_the_meeting_is_booked(self):
		frappe.set_user(self.outsider.name)
		with patch.object(lms_batch, "requests") as mocked_requests:
			with self.assertRaises(frappe.PermissionError):
				lms_batch.create_live_class(
					batch_name=self.batch,
					zoom_account="does-not-matter",
					title="Hijacked Class",
					duration=30,
					date=nowdate(),
					time="10:00:00",
					timezone="Asia/Kolkata",
					auto_recording="No Recording",
				)
			mocked_requests.post.assert_not_called()

	def test_an_untagged_evaluator_cannot_create_a_google_meet_class(self):
		frappe.set_user(self.outsider.name)
		with self.assertRaises(frappe.PermissionError):
			lms_batch.create_google_meet_live_class(
				batch_name=self.batch,
				google_meet_account="does-not-exist",
				title="Hijacked Class",
				duration=30,
				date=nowdate(),
				time="10:00:00",
				timezone="Asia/Kolkata",
			)

	def test_a_tagged_instructor_without_live_class_create_permission_cannot_book_a_meeting(self):
		# Batch authorship alone is not enough; the caller also needs the DocPerm,
		# checked before either provider is called so no meeting is ever orphaned.
		frappe.set_user(self.course_author.name)
		self.assertTrue(lms_batch.can_author_batch(self.no_create_perm_batch))
		self.assertFalse(frappe.has_permission("LMS Live Class", "create"))

		with patch.object(lms_batch, "requests") as mocked_requests:
			with self.assertRaises(frappe.PermissionError):
				lms_batch.create_live_class(
					batch_name=self.no_create_perm_batch,
					zoom_account="does-not-matter",
					title="Hijacked Class",
					duration=30,
					date=nowdate(),
					time="10:00:00",
					timezone="Asia/Kolkata",
					auto_recording="No Recording",
				)
			mocked_requests.post.assert_not_called()

		with self.assertRaises(frappe.PermissionError):
			lms_batch.create_google_meet_live_class(
				batch_name=self.no_create_perm_batch,
				google_meet_account="does-not-exist",
				title="Hijacked Class",
				duration=30,
				date=nowdate(),
				time="10:00:00",
				timezone="Asia/Kolkata",
			)
