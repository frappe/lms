# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import frappe
import frappe.client

from lms.lms.permissions import course_record_query_conditions
from lms.lms.test_helpers import BaseTestUtils

# The three doctypes that hold one learner's record of one course, keyed to the field
# naming that learner.
RECORD_DOCTYPES = {
	"LMS Course Progress": "member",
	"LMS Video Watch Duration": "member",
	"LMS Course Review": "owner",
}


class TestCourseRecordScope(BaseTestUtils):
	"""A learner record belongs to its learner and to the authors of its course.

	Before this rule, any Course Creator could read, rewrite, delete and enumerate
	every learner's completion, watch time and review on the site."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.hash = hash
		cls.author = cls._create_user(f"rsauth-{hash}@example.com", "Ann", "Author", ["Course Creator"])
		cls.outsider = cls._create_user(f"rsout-{hash}@example.com", "Otto", "Outside", ["Course Creator"])
		cls.evaluator = cls._create_user(f"rseval-{hash}@example.com", "Eve", "Eval", ["Batch Evaluator"])
		cls.moderator = cls._create_user(f"rsmod-{hash}@example.com", "Mo", "Derator", ["Moderator"])
		cls.learner = cls._create_user(f"rslrn-{hash}@example.com", "Lee", "Learner", ["LMS Student"])
		cls.other_learner = cls._create_user(f"rsoth-{hash}@example.com", "Ola", "Other", ["LMS Student"])

		cls.course = cls._create_course(title=f"Record Scope Course {hash}", instructor=cls.author.name)
		cls.chapter = cls._create_chapter(f"RS Chapter {hash}", cls.course.name)
		cls.lesson = cls._create_lesson(f"RS Lesson {hash}", cls.chapter.name, cls.course.name)
		cls.second_lesson = cls._create_lesson(f"RS Lesson B {hash}", cls.chapter.name, cls.course.name)
		cls._create_enrollment(cls.learner.name, cls.course.name)
		cls._create_enrollment(cls.other_learner.name, cls.course.name)

		# A Course Creator enrolled as a learner. LMS Student's read on these doctypes
		# is if_owner, so a plain learner is refused another learner's row by the
		# DocPerm before the rule is consulted -- only an unscoped read makes the
		# member branch observable at all.
		cls.enrolled_creator = cls._create_user(
			f"rsenr-{hash}@example.com", "Ela", "Enrolled", ["Course Creator"]
		)
		cls._create_enrollment(cls.enrolled_creator.name, cls.course.name)

		cls.progress = cls._new_progress(cls.learner.name, cls.lesson.name)
		cls.watch = cls._new_watch(cls.learner.name, cls.lesson.name, "YouTube", "42")
		cls.review = cls._add_rating(cls.course.name, cls.learner.name, 0.8, "A fine course")

		# The same three rows for a second learner, with their course pointed at a name
		# that no longer resolves. An unresolvable course must be denied, not shown.
		cls.gone_course = f"rs-course-that-is-gone-{hash}"
		cls.orphans = {
			"LMS Course Progress": cls._new_progress(cls.other_learner.name, cls.second_lesson.name).name,
			"LMS Video Watch Duration": cls._new_watch(
				cls.other_learner.name, cls.second_lesson.name, "Vimeo", "7"
			).name,
			"LMS Course Review": cls._add_rating(
				cls.course.name, cls.other_learner.name, 0.6, "Also fine"
			).name,
		}
		for doctype, name in cls.orphans.items():
			frappe.db.set_value(doctype, name, "course", cls.gone_course, update_modified=False)

		cls.enrolled_creator_progress = cls._new_progress(cls.enrolled_creator.name, cls.second_lesson.name)

		cls.rows = {
			"LMS Course Progress": cls.progress.name,
			"LMS Video Watch Duration": cls.watch.name,
			"LMS Course Review": cls.review.name,
		}

	@classmethod
	def _new_progress(cls, member, lesson):
		"""As the learner, the way _save_progress writes it: LMS Student holds no
		`create` on LMS Course Progress, and its `read` is `if_owner`, so a row inserted
		by anyone else is one its own learner cannot read."""
		original = frappe.session.user
		frappe.set_user(member)
		try:
			progress = frappe.new_doc("LMS Course Progress")
			progress.update({"lesson": lesson, "member": member, "status": "Complete"})
			# nosemgrep: lms-unjustified-ignore-permissions - the product path is identical
			progress.save(ignore_permissions=True)
			return progress
		finally:
			frappe.set_user(original)

	@classmethod
	def _new_watch(cls, member, lesson, source, watch_time):
		original = frappe.session.user
		frappe.set_user(member)
		try:
			watch = frappe.new_doc("LMS Video Watch Duration")
			watch.update({"lesson": lesson, "member": member, "source": source, "watch_time": watch_time})
			watch.insert()
			return watch
		finally:
			frappe.set_user(original)

	def _as(self, user):
		frappe.set_user(user)
		return user

	def _listed(self, doctype):
		return {row.name for row in frappe.get_list(doctype, limit_page_length=0)}

	# The wrong actor, on both paths

	def test_a_course_creator_who_does_not_author_the_course_cannot_read_a_record(self):
		self._as(self.outsider.name)
		for doctype, name in self.rows.items():
			with self.subTest(doctype=doctype):
				with self.assertRaises(frappe.PermissionError):
					frappe.client.get(doctype, name)

	def test_a_course_creator_who_does_not_author_the_course_cannot_list_records(self):
		self._as(self.outsider.name)
		for doctype, name in self.rows.items():
			with self.subTest(doctype=doctype):
				self.assertNotIn(name, self._listed(doctype))

	def test_a_course_creator_who_does_not_author_the_course_cannot_forge_a_completion(self):
		self._as(self.outsider.name)
		with self.assertRaises(frappe.PermissionError):
			frappe.client.set_value("LMS Course Progress", self.progress.name, "status", "Incomplete")

		self._as("Administrator")
		self.assertEqual(frappe.db.get_value("LMS Course Progress", self.progress.name, "status"), "Complete")

	def test_a_course_creator_who_does_not_author_the_course_cannot_rewrite_watch_time(self):
		self._as(self.outsider.name)
		with self.assertRaises(frappe.PermissionError):
			frappe.client.set_value("LMS Video Watch Duration", self.watch.name, "watch_time", "9999")

		self._as("Administrator")
		self.assertEqual(frappe.db.get_value("LMS Video Watch Duration", self.watch.name, "watch_time"), "42")

	def test_a_course_creator_who_does_not_author_the_course_cannot_delete_a_record(self):
		for doctype, name in self.rows.items():
			with self.subTest(doctype=doctype):
				self._as(self.outsider.name)
				with self.assertRaises(frappe.PermissionError):
					frappe.delete_doc(doctype, name)
				self._as("Administrator")
				self.assertTrue(frappe.db.exists(doctype, name))

	def test_a_course_creator_cannot_mint_a_completion_for_a_learner_on_another_course(self):
		"""`create` is checked before `course` is fetched from the chapter, so the gate
		resolves the course through the lesson the caller did send."""
		self._as(self.outsider.name)
		progress = frappe.new_doc("LMS Course Progress")
		progress.update({"member": self.other_learner.name, "lesson": self.lesson.name, "status": "Complete"})
		with self.assertRaises(frappe.PermissionError):
			progress.insert()

	def test_a_batch_evaluator_unrelated_to_the_course_cannot_reach_a_review(self):
		"""Batch Evaluator holds read+write+create+delete on LMS Course Review and
		nothing on the two progress doctypes, so the review is its whole surface."""
		self._as(self.evaluator.name)
		with self.assertRaises(frappe.PermissionError):
			frappe.client.get("LMS Course Review", self.review.name)
		self.assertNotIn(self.review.name, self._listed("LMS Course Review"))
		with self.assertRaises(frappe.PermissionError):
			frappe.delete_doc("LMS Course Review", self.review.name)
		self._as("Administrator")
		self.assertTrue(frappe.db.exists("LMS Course Review", self.review.name))

	def test_a_guest_reaches_no_record_on_either_path(self):
		self._as("Guest")
		for doctype, name in self.rows.items():
			with self.subTest(doctype=doctype):
				with self.assertRaises(frappe.PermissionError):
					frappe.client.get(doctype, name)
				with self.assertRaises(frappe.PermissionError):
					frappe.get_list(doctype, limit_page_length=0)

	# Controls the fix must not move

	def test_the_courses_own_instructor_still_reaches_every_record_on_both_paths(self):
		self._as(self.author.name)
		for doctype, name in self.rows.items():
			with self.subTest(doctype=doctype):
				self.assertTrue(frappe.client.get(doctype, name)["name"])
				self.assertIn(name, self._listed(doctype))

	def test_the_courses_own_instructor_can_still_correct_its_records(self):
		self._as(self.author.name)
		frappe.client.set_value("LMS Course Progress", self.progress.name, "status", "Partially Complete")
		self.assertEqual(
			frappe.db.get_value("LMS Course Progress", self.progress.name, "status"), "Partially Complete"
		)

	def test_a_moderator_still_reaches_every_record_on_both_paths(self):
		self._as(self.moderator.name)
		for doctype, name in self.rows.items():
			with self.subTest(doctype=doctype):
				self.assertTrue(frappe.client.get(doctype, name)["name"])
				self.assertIn(name, self._listed(doctype))

	def test_the_learner_still_records_their_own_watch_time(self):
		"""track_new_watch_time calls a bare doc.save() as the session user, so the
		LMS Student create grant is load-bearing and the gate must not touch it."""
		from lms.lms.api import track_new_watch_time

		self._as(self.learner.name)
		track_new_watch_time(self.lesson.name, {"source": "Vimeo", "watch_time": "11"})
		self._as("Administrator")
		self.assertTrue(
			frappe.db.exists(
				"LMS Video Watch Duration",
				{"lesson": self.lesson.name, "member": self.learner.name, "source": "Vimeo"},
			)
		)

	def test_the_learner_still_completes_a_lesson_through_save_progress(self):
		from lms.lms.doctype.course_lesson.course_lesson import save_progress

		self._as(self.learner.name)
		save_progress(lesson=self.second_lesson.name, course=self.course.name)
		self._as("Administrator")
		self.assertTrue(
			frappe.db.exists(
				"LMS Course Progress",
				{"lesson": self.second_lesson.name, "member": self.learner.name, "status": "Complete"},
			)
		)

	def test_the_learner_still_writes_their_own_review(self):
		second_course = self._create_course(
			title=f"Record Scope Course B {self.hash}", instructor=self.author.name
		)
		self._create_enrollment(self.learner.name, second_course.name)
		self._as(self.learner.name)
		review = frappe.new_doc("LMS Course Review")
		review.update({"course": second_course.name, "rating": 1.0, "review": "Loved it"})
		review.insert()
		self.assertEqual(review.owner, self.learner.name)

	def test_the_learner_still_reads_their_own_records_on_both_paths(self):
		self._as(self.learner.name)
		for doctype, name in self.rows.items():
			with self.subTest(doctype=doctype):
				self.assertEqual(frappe.client.get(doctype, name)["name"], name)
				self.assertIn(name, self._listed(doctype))

	def test_a_learner_still_reads_their_own_progress_through_client_get_value(self):
		"""The SCORMChapter.vue path: frappe.client.get_value runs through get_list, so
		the query condition decides it."""
		self._as(self.learner.name)
		self.assertEqual(
			frappe.client.get_value("LMS Course Progress", ["status"], {"name": self.progress.name}),
			{"status": "Complete"},
		)

	def test_a_learner_still_counts_their_own_review_through_client_get_count(self):
		"""The CourseReviews.vue path."""
		self._as(self.learner.name)
		self.assertEqual(
			frappe.client.get_count(
				"LMS Course Review", {"course": self.course.name, "owner": self.learner.name}
			),
			1,
		)

	def test_the_member_branch_grants_only_the_learners_own_row(self):
		"""An enrolled Course Creator authors none of these doctypes, so only the
		member branch can grant their own row, isolated from if_owner and the
		unresolvable-course branch."""
		self._as("Administrator")
		own = self.enrolled_creator_progress.name
		self.assertEqual(
			frappe.db.get_value("LMS Course Progress", own, "course"),
			self.course.name,
			"fixture is wrong: the control row must resolve to a live course",
		)

		self._as(self.enrolled_creator.name)
		self.assertEqual(frappe.client.get("LMS Course Progress", own)["name"], own)
		self.assertIn(own, self._listed("LMS Course Progress"))

		for doctype, name in self.rows.items():
			with self.subTest(doctype=doctype):
				with self.assertRaises(frappe.PermissionError):
					frappe.client.get(doctype, name)
				self.assertNotIn(name, self._listed(doctype))

	# The unresolvable course

	def test_a_record_whose_course_is_gone_is_denied_not_shown(self):
		for actor in (self.outsider.name, self.evaluator.name, self.author.name):
			for doctype, name in self.orphans.items():
				with self.subTest(actor=actor, doctype=doctype):
					self._as(actor)
					doc = frappe.get_doc(doctype, name)
					self.assertFalse(frappe.has_permission(doctype, "read", doc=doc, user=actor))
					self.assertNotIn(name, self._listed(doctype))

	def test_a_saved_record_whose_course_column_is_empty_is_denied_not_shown(self):
		"""The gate reads a saved row exactly as the query condition reads it. Resolving
		an empty `course` back through the lesson would grant the lesson's author a row
		the list layer drops, and the two layers would disagree on it."""
		self._as("Administrator")
		frappe.db.set_value("LMS Course Progress", self.progress.name, "course", "", update_modified=False)
		try:
			self._as(self.author.name)
			doc = frappe.get_doc("LMS Course Progress", self.progress.name)
			self.assertFalse(
				frappe.has_permission("LMS Course Progress", "read", doc=doc, user=self.author.name)
			)
			self.assertNotIn(self.progress.name, self._listed("LMS Course Progress"))
		finally:
			self._as("Administrator")
			frappe.db.set_value(
				"LMS Course Progress", self.progress.name, "course", self.course.name, update_modified=False
			)

	def test_a_moderator_still_sees_a_record_whose_course_is_gone_on_both_paths(self):
		"""Both layers decline to narrow a Moderator before either reads the row, so the
		unresolvable course produces agreement rather than a one-sided refusal."""
		self._as(self.moderator.name)
		for doctype, name in self.orphans.items():
			with self.subTest(doctype=doctype):
				doc = frappe.get_doc(doctype, name)
				self.assertTrue(frappe.has_permission(doctype, "read", doc=doc, user=self.moderator.name))
				self.assertIn(name, self._listed(doctype))

	# The two layers

	def test_the_two_layers_agree_for_every_actor_on_every_row(self):
		actors = (
			self.outsider.name,
			self.evaluator.name,
			self.author.name,
			self.moderator.name,
			self.learner.name,
			self.other_learner.name,
			self.enrolled_creator.name,
		)
		rows = {**self.rows}
		for actor in actors:
			for doctype, name in list(rows.items()) + list(self.orphans.items()):
				with self.subTest(actor=actor, doctype=doctype, name=name):
					self._as(actor)
					try:
						listed = name in self._listed(doctype)
					except frappe.PermissionError:
						# Refused at the doctype gate, before the condition is consulted.
						continue
					doc = frappe.get_doc(doctype, name)
					self.assertEqual(
						frappe.has_permission(doctype, "read", doc=doc, user=actor),
						listed,
						f"{actor} disagrees on {doctype} {name}",
					)

	# Registration and shape

	def test_both_halves_are_registered_for_all_three_doctypes(self):
		for doctype in RECORD_DOCTYPES:
			with self.subTest(doctype=doctype):
				self.assertEqual(
					frappe.get_hooks("has_permission").get(doctype),
					["lms.lms.permissions.course_record_has_permission"],
				)
				self.assertEqual(
					frappe.get_hooks("permission_query_conditions").get(doctype),
					["lms.lms.permissions.course_record_query_conditions"],
				)

	def test_the_query_condition_refuses_a_doctype_it_does_not_gate(self):
		""" "" is the list engine's spelling of no restriction, so the default has to
		refuse explicitly."""
		self.assertEqual(course_record_query_conditions(self.outsider.name, doctype="LMS Batch"), "1 = 0")
		self.assertEqual(course_record_query_conditions(self.outsider.name, doctype=None), "1 = 0")

	def test_the_query_condition_is_a_plain_string_that_escapes_the_user(self):
		condition = course_record_query_conditions(self.outsider.name, doctype="LMS Course Progress")
		self.assertIsInstance(condition, str)
		self.assertIn(frappe.db.escape(self.outsider.name), condition)

	# The stored row, not the caller's payload

	def test_editing_the_course_field_cannot_move_a_record_out_of_its_authors_reach(self):
		"""The gate reads the STORED `course`, not the value submitted with the edit."""
		other_course = self._create_course(
			title=f"Record Scope Course C {self.hash}", instructor=self.outsider.name
		)
		doc = frappe.get_doc("LMS Course Progress", self.progress.name)
		doc.course = other_course.name

		self._as(self.outsider.name)
		self.assertFalse(
			frappe.has_permission("LMS Course Progress", "write", doc=doc, user=self.outsider.name)
		)

	def test_relabelling_the_member_field_cannot_claim_another_learners_row(self):
		doc = frappe.get_doc("LMS Course Progress", self.progress.name)
		doc.member = self.outsider.name

		self._as(self.outsider.name)
		self.assertFalse(
			frappe.has_permission("LMS Course Progress", "write", doc=doc, user=self.outsider.name)
		)

	def test_an_author_cannot_move_a_record_into_a_course_they_do_not_author(self):
		other_course = self._create_course(
			title=f"Record Scope Course D {self.hash}", instructor=self.outsider.name
		)
		doc = frappe.get_doc("LMS Course Progress", self.progress.name)
		doc.course = other_course.name

		self._as(self.author.name)
		self.assertFalse(
			frappe.has_permission("LMS Course Progress", "write", doc=doc, user=self.author.name)
		)

	def test_a_system_manager_still_reaches_every_record_course_and_chapter(self):
		admin = self._create_user(f"rssys-{self.hash}@example.com", "Sys", "Admin", ["System Manager"])
		self._as(admin.name)
		for doctype, name in (
			("LMS Course Progress", self.progress.name),
			("LMS Course", self.course.name),
			("Course Chapter", self.chapter.name),
		):
			for ptype in ("read", "write"):
				with self.subTest(doctype=doctype, ptype=ptype):
					self.assertTrue(frappe.has_permission(doctype, ptype, doc=name, user=admin.name))
		self.assertIn(self.progress.name, self._listed("LMS Course Progress"))

	def test_a_learner_cannot_reassign_their_own_row_to_another_learner(self):
		doc = frappe.get_doc("LMS Course Progress", self.enrolled_creator_progress.name)
		doc.member = self.learner.name

		self._as(self.enrolled_creator.name)
		self.assertFalse(
			frappe.has_permission("LMS Course Progress", "write", doc=doc, user=self.enrolled_creator.name)
		)
