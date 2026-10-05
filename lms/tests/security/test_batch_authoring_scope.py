# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""The Batch Evaluator role grants batch authoring; the batch's own tags decide which batch.

Every check passes the document: frappe.has_permission without one never reaches the
has_permission hook.
"""

import json
from unittest.mock import patch

import frappe
from frappe.client import set_value
from frappe.utils import nowdate

from lms.lms.api import get_announcements
from lms.lms.doctype.lms_batch import lms_batch
from lms.lms.doctype.lms_live_class.lms_live_class import LMSLiveClass
from lms.lms.permissions import can_author_batch
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_batch_details

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
		cls.course_creator_batch = cls._create_batch(
			course=course,
			instructor=cls.course_author.name,
			title=f"BAS Course Creator Batch {hash}",
			evaluator=cls.evaluator.name,
		).name
		# A separate user: tagged as a Batch Course *evaluator* only, no Course
		# Instructor row -- the path can_modify_batch() cannot see but
		# can_author_batch() can. A distinct user from course_author, because
		# _create_evaluator grants the global Batch Evaluator role as a side
		# effect and would otherwise stop testing a *scoped* Course Creator.
		cls.evaluator_tagged_creator = cls._create_user(
			f"bas-etc-{hash}@example.com", "Eve", "Tag", ["Course Creator"]
		)
		cls._create_evaluator(cls.evaluator_tagged_creator.name)
		cls.evaluator_only_batch = cls._create_batch(
			course=course,
			instructor=cls.outsider.name,
			title=f"BAS Evaluator Only Batch {hash}",
			evaluator=cls.evaluator_tagged_creator.name,
		).name
		frappe.db.set_value("LMS Batch", cls.evaluator_only_batch, "published", 0)

		cls.other_author = cls._create_user(f"bas-oa-{hash}@example.com", "Oli", "Author", ["Course Creator"])
		cls.other_course = cls._create_course(
			title=f"BAS Other Course {hash}", instructor=cls.other_author.name
		).name
		cls.other_quiz = cls._create_quiz(cls._create_quiz_questions(), title=f"BAS Other Quiz {hash}")
		cls._set_authors("LMS Quiz", cls.other_quiz.name, [cls.other_author.name])

		cls.live_class = cls._live_class(cls.batch)
		cls.zoom_account = cls._zoom_account(f"BAS Zoom {hash}")

	@classmethod
	def _zoom_account(cls, account_name):
		frappe.get_doc(
			{
				"doctype": "LMS Zoom Settings",
				"account_name": account_name,
				"account_id": "acc-id",
				"client_id": "client-id",
				"client_secret": "secret",
				"member": "Administrator",
				"enabled": 1,
			}
		).insert()
		return account_name

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

	def test_a_bare_system_manager_keeps_read_on_an_unpublished_batch(self):
		frappe.db.set_value("LMS Batch", self.outsider_batch, "published", 0)
		self.assertTrue(self._can(self.system_manager.name, "LMS Batch", self.outsider_batch, "read"))
		# get_list, not get_all: get_all runs with ignore_permissions=True by
		# default and would pass even if the query condition hook were broken.
		self.assertTrue(
			frappe.get_list("LMS Batch", filters={"name": self.outsider_batch}, user=self.system_manager.name)
		)

	def test_a_course_creator_cannot_create_a_batch(self):
		doc = frappe.new_doc("LMS Batch")
		self.assertFalse(frappe.has_permission("LMS Batch", "create", doc=doc, user=self.course_author.name))

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

	def test_an_untagged_course_creator_cannot_author_a_batch(self):
		for ptype in AUTHORING:
			with self.subTest(ptype=ptype):
				self.assertFalse(self._can(self.course_author.name, "LMS Batch", self.batch, ptype))

	def test_a_tagged_course_creator_can_author_a_batch_and_its_live_class(self):
		# Manage, not own: a Moderator or evaluator creates and deletes the batch.
		self.assertTrue(self._can(self.course_author.name, "LMS Batch", self.course_creator_batch, "write"))
		self.assertFalse(self._can(self.course_author.name, "LMS Batch", self.course_creator_batch, "delete"))
		live_class = self._live_class(self.course_creator_batch)
		self.assertTrue(self._can(self.course_author.name, "LMS Live Class", live_class, "write"))

	def test_a_tagged_course_creator_can_book_a_zoom_meeting(self):
		# The gate create_live_class checks: batch tagging AND the create DocPerm.
		frappe.set_user(self.course_author.name)
		self.assertTrue(lms_batch.can_author_batch(self.course_creator_batch))
		self.assertTrue(frappe.has_permission("LMS Live Class", "create"))

		# Zoom auth and the calendar side effect of saving a live class are not
		# what this test is about; both are stubbed out.
		with (
			patch.object(lms_batch, "authenticate", return_value="fake-token"),
			patch.object(lms_batch, "requests") as mocked_requests,
			patch.object(LMSLiveClass, "create_calendar_event"),
		):
			mocked_requests.post.return_value.status_code = 201
			mocked_requests.post.return_value.text = json.dumps(
				{
					"start_url": "https://zoom.us/s/1",
					"join_url": "https://zoom.us/j/1",
					"id": "1",
					"uuid": "u",
				}
			)
			class_details = lms_batch.create_live_class(
				batch_name=self.course_creator_batch,
				zoom_account=self.zoom_account,
				title="Course Creator Class",
				duration=30,
				date=nowdate(),
				time="10:00:00",
				timezone="Asia/Kolkata",
				auto_recording="No Recording",
			)
			mocked_requests.post.assert_called_once()

		self.assertEqual(class_details.batch_name, self.course_creator_batch)

	def test_an_untagged_course_creator_cannot_book_a_meeting(self):
		frappe.set_user(self.course_author.name)
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

	def test_a_tagged_course_creator_can_enrol_a_student(self):
		student = self._create_user(
			f"bas-enrol-{frappe.generate_hash(length=6)}@example.com", "Enn", "Rol", ["LMS Student"]
		)
		frappe.set_user(self.course_author.name)
		enrollment = frappe.new_doc(
			"LMS Batch Enrollment", batch=self.course_creator_batch, member=student.name
		)
		enrollment.insert()
		self.assertEqual(enrollment.batch, self.course_creator_batch)

	def test_an_untagged_course_creator_cannot_enrol_a_student(self):
		student = self._create_user(
			f"bas-noenrol-{frappe.generate_hash(length=6)}@example.com", "Nay", "Rol", ["LMS Student"]
		)
		frappe.set_user(self.course_author.name)
		enrollment = frappe.new_doc("LMS Batch Enrollment", batch=self.batch, member=student.name)
		# has_permission denies the create outright now, before validate_owner()
		# would otherwise raise a ValidationError.
		with self.assertRaises(frappe.PermissionError):
			enrollment.insert()
		frappe.set_user("Administrator")

	def test_a_course_creators_batch_list_is_scoped_to_their_own_tagged_batches(self):
		frappe.db.set_value("LMS Batch", self.batch, "published", 0)
		frappe.db.set_value("LMS Batch", self.course_creator_batch, "published", 0)
		# get_list, not get_all: get_all ignores permissions by default.
		names = frappe.get_list("LMS Batch", pluck="name", user=self.course_author.name)
		self.assertIn(self.course_creator_batch, names)
		self.assertNotIn(self.batch, names)

	# --- LMS Batch Enrollment: scoped to the batches you author -----------------

	def _enrollment_can(self, user, name, ptype):
		return frappe.has_permission(
			"LMS Batch Enrollment", ptype, doc=frappe.get_doc("LMS Batch Enrollment", name), user=user
		)

	def test_a_tagged_course_creator_can_manage_their_own_batchs_enrollment(self):
		enrollment = self._create_batch_enrollment(self.student.name, self.course_creator_batch)
		for ptype in ("read", "write", "delete"):
			with self.subTest(ptype=ptype):
				self.assertTrue(self._enrollment_can(self.course_author.name, enrollment.name, ptype))

	def test_a_tagged_course_creator_cannot_reach_another_batchs_enrollment(self):
		other_student = self._create_user(
			f"bas-oe-{frappe.generate_hash(length=6)}@example.com", "Ova", "Enr", ["LMS Student"]
		)
		enrollment = self._create_batch_enrollment(other_student.name, self.batch)
		for ptype in ("read", "write", "delete"):
			with self.subTest(ptype=ptype):
				self.assertFalse(self._enrollment_can(self.course_author.name, enrollment.name, ptype))

	def test_a_tagged_course_creator_cannot_list_another_batchs_enrollments(self):
		other_student = self._create_user(
			f"bas-ol-{frappe.generate_hash(length=6)}@example.com", "Ola", "Enr", ["LMS Student"]
		)
		enrollment = self._create_batch_enrollment(other_student.name, self.batch)
		names = frappe.get_list(
			"LMS Batch Enrollment", pluck="name", user=self.course_author.name, filters={"batch": self.batch}
		)
		self.assertNotIn(enrollment.name, names)

	def test_an_enrolled_member_reads_their_own_enrollment_row(self):
		member = self._create_user(
			f"bas-self-{frappe.generate_hash(length=6)}@example.com", "Selfa", "Enr", ["LMS Student"]
		)
		frappe.db.set_value("LMS Batch", self.course_creator_batch, "allow_self_enrollment", 1)
		frappe.set_user(member.name)
		enrollment = frappe.new_doc(
			"LMS Batch Enrollment", batch=self.course_creator_batch, member=member.name
		)
		enrollment.insert()
		frappe.set_user("Administrator")
		self.assertTrue(self._enrollment_can(member.name, enrollment.name, "read"))

	def test_a_bare_system_manager_keeps_enrollment_access(self):
		other_student = self._create_user(
			f"bas-sme-{frappe.generate_hash(length=6)}@example.com", "Smea", "Enr", ["LMS Student"]
		)
		enrollment = self._create_batch_enrollment(other_student.name, self.batch)
		for ptype in ("read", "write", "delete"):
			with self.subTest(ptype=ptype):
				self.assertTrue(self._enrollment_can(self.system_manager.name, enrollment.name, ptype))

	def test_moving_an_enrollment_out_of_your_batch_does_not_authorise_the_save(self):
		enrollment = self._create_batch_enrollment(self.student.name, self.course_creator_batch)
		doc = frappe.get_doc("LMS Batch Enrollment", enrollment.name)
		doc.batch = self.batch
		self.assertFalse(
			frappe.has_permission("LMS Batch Enrollment", "write", doc=doc, user=self.course_author.name)
		)

	def test_a_course_creator_can_only_create_an_enrollment_for_a_batch_they_author(self):
		doc = frappe.new_doc("LMS Batch Enrollment", batch=self.batch, member=self.student.name)
		self.assertFalse(
			frappe.has_permission("LMS Batch Enrollment", "create", doc=doc, user=self.course_author.name)
		)
		doc = frappe.new_doc(
			"LMS Batch Enrollment", batch=self.course_creator_batch, member=self.student.name
		)
		self.assertTrue(
			frappe.has_permission("LMS Batch Enrollment", "create", doc=doc, user=self.course_author.name)
		)

	# --- LMS Batch: adding someone else's assessment/course does not authorise it ---

	def test_a_tagged_course_creator_cannot_add_another_authors_quiz_to_their_batch(self):
		batch = frappe.get_doc("LMS Batch", self.course_creator_batch)
		batch.append("assessment", {"assessment_type": "LMS Quiz", "assessment_name": self.other_quiz.name})
		frappe.set_user(self.course_author.name)
		with self.assertRaises(frappe.PermissionError):
			batch.save()
		frappe.set_user("Administrator")

	def test_a_tagged_course_creator_can_add_their_own_quiz_to_their_batch(self):
		quiz = self._create_quiz(
			self._create_quiz_questions(), title=f"BAS Own Quiz {frappe.generate_hash(length=6)}"
		)
		self._set_authors("LMS Quiz", quiz.name, [self.course_author.name])

		batch = frappe.get_doc("LMS Batch", self.course_creator_batch)
		batch.append("assessment", {"assessment_type": "LMS Quiz", "assessment_name": quiz.name})
		frappe.set_user(self.course_author.name)
		batch.save()
		frappe.set_user("Administrator")
		self.assertIn(quiz.name, [row.assessment_name for row in batch.assessment])

	def test_a_tagged_course_creator_cannot_add_another_authors_course_to_their_batch(self):
		batch = frappe.get_doc("LMS Batch", self.course_creator_batch)
		batch.append("courses", {"course": self.other_course})
		frappe.set_user(self.course_author.name)
		with self.assertRaises(frappe.PermissionError):
			batch.save()
		frappe.set_user("Administrator")

	def test_a_moderator_can_still_add_any_assessment_to_a_batch(self):
		batch = frappe.get_doc("LMS Batch", self.course_creator_batch)
		batch.append("assessment", {"assessment_type": "LMS Quiz", "assessment_name": self.other_quiz.name})
		frappe.set_user(self.moderator.name)
		batch.save()
		frappe.set_user("Administrator")
		self.assertIn(self.other_quiz.name, [row.assessment_name for row in batch.assessment])

	# --- get_batch_details: a Batch Course evaluator is a batch admin too ---------

	def test_a_batch_course_evaluator_gets_batch_admin_details(self):
		frappe.set_user(self.evaluator_tagged_creator.name)
		details = get_batch_details(self.evaluator_only_batch)
		frappe.set_user("Administrator")
		self.assertTrue(details.get("can_manage"))
		self.assertIn("students", details)

	def test_an_outsider_gets_no_details_for_an_unpublished_batch(self):
		# A plain student: unlike self.outsider, holds no Batch Evaluator role.
		frappe.set_user(self.student.name)
		details = get_batch_details(self.evaluator_only_batch)
		frappe.set_user("Administrator")
		self.assertEqual(details, {})

	def test_can_author_batch_recognises_a_batch_course_evaluator(self):
		self.assertTrue(can_author_batch(self.evaluator_only_batch, user=self.evaluator_tagged_creator.name))

	def test_an_untagged_evaluator_gets_no_roster_for_an_unpublished_batch(self):
		"""The global Batch Evaluator role must not open another batch's roster;
		only a tag on the batch (can_author_batch) does."""
		frappe.db.set_value("LMS Batch", self.batch, "published", 0)
		frappe.set_user(self.outsider.name)
		self.assertEqual(get_batch_details(self.batch), {})

	def test_a_tagged_course_creator_reads_their_batchs_announcements(self):
		frappe.set_user(self.course_author.name)
		self.assertIsInstance(get_announcements(self.course_creator_batch), list)
