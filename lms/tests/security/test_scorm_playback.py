# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

from unittest.mock import patch

import frappe
from frappe.exceptions import FrappeTypeError

from lms.lms.doctype.course_chapter.course_chapter import get_scorm_playback
from lms.tests.security.test_chapter_scorm_field_scope import (
	LAUNCH_FILE,
	ScormChapterFixture,
)


class TestScormPlayback(ScormChapterFixture):
	"""The replacement read: an enrolled student still plays, through the server. The
	permlevel black-screens SCORMChapter.vue on its own; get_scorm_playback is what it
	reads instead, off the same pair SCORMRenderer._check_permission refuses bytes on."""

	def _playback(self, label):
		frappe.set_user(getattr(self, label).name)
		try:
			return get_scorm_playback(self.chapter.name)
		finally:
			frappe.set_user("Administrator")

	def _playback_and_warnings(self, label):
		"""One playback answer, and the lms.security warnings it emitted. Every other
		logger is handed back the real one: silencing the rest of frappe would change what
		the code under test runs."""
		recorded = []
		real_logger = frappe.logger

		def logger(module=None, *args, **kwargs):
			if module != "lms.security":
				return real_logger(module, *args, **kwargs)
			return frappe._dict(warning=lambda *call: recorded.append(call))

		with patch.object(frappe, "logger", logger):
			answer = self._playback(label)
		return answer, recorded

	def test_a_control_the_author_still_reaches_the_launch_file(self):
		"""Read this before the refusals. An author is exempt from sequencing and is
		never enrolled, so a gate answering them wrongly would look like a pass on
		everything else here."""
		self.assertEqual(self._playback("creator")["launch_file"], LAUNCH_FILE)

	def test_an_enrolled_student_reaches_the_launch_file(self):
		"""The regression guard on the permlevel. Red here means this change has
		shipped a player that renders an empty iframe for everyone enrolled."""
		answer = self._playback("learner")
		self.assertEqual(answer["launch_file"], LAUNCH_FILE)
		self.assertEqual(answer["locked"], 0)
		self.assertEqual(answer["can_access"], 1)
		self.assertEqual(answer["lesson"], self.lesson.name)
		self.assertEqual(answer["course"], self.course.name)
		self.assertEqual(answer["title"], self.chapter.title)

	def test_an_unenrolled_account_is_told_it_may_not_play(self):
		answer = self._playback("outsider")
		self.assertIsNone(
			answer["launch_file"],
			"the endpoint handed the launch file to an account enrolled in nothing",
		)
		self.assertEqual(answer["can_access"], 0)
		self.assertEqual(answer["locked"], 0)

	def test_a_locked_chapter_withholds_the_launch_file_from_its_own_student(self):
		"""The gate the doctype read defeated. With sequential completion on and the
		lesson before it unfinished, the enrolled student is told locked rather than
		handed a URL SCORMRenderer would then refuse."""
		frappe.db.set_value("LMS Course", self.course.name, "enforce_lesson_completion", 1)
		answer = self._playback("learner")
		self.assertEqual(answer["locked"], 1)
		self.assertIsNone(
			answer["launch_file"],
			"the endpoint handed the launch file out for a chapter the gate has not opened",
		)

	def test_a_chapter_that_does_not_exist_is_refused_rather_than_answered(self):
		"""`/learn/:chapterName` also matches a lesson URL with no lesson number, so a
		mistyped address arrives here as a chapter that is not there, and the page reads
		the error to send the student back to the course."""
		frappe.set_user(self.learner.name)
		try:
			with self.assertRaises(frappe.DoesNotExistError):
				get_scorm_playback(f"no-such-chapter-{frappe.generate_hash(length=6)}")
		finally:
			frappe.set_user("Administrator")

	def test_a_non_string_chapter_is_refused_at_the_boundary(self):
		"""A filter operator posted where a name belongs. The annotated signature is
		what refuses it — frappe coerces whitelisted arguments off the annotation — so
		this asserts the framework's refusal, and the empty-name case below asserts the
		function's own guard, which is what covers a call made in process."""
		frappe.set_user(self.learner.name)
		try:
			with self.assertRaises(FrappeTypeError):
				get_scorm_playback(["!=", ""])
		finally:
			frappe.set_user("Administrator")

	def test_an_empty_chapter_name_is_refused_by_the_functions_own_guard(self):
		"""Reached past the coercion deliberately. frappe's whitelisted-argument
		validation is gated on `frappe.in_test` and is off in a plain process, so the
		isinstance guard inside the function is the half that has to hold on its own."""
		frappe.set_user(self.learner.name)
		try:
			with self.assertRaises(frappe.ValidationError):
				get_scorm_playback.__wrapped__("")
			with self.assertRaises(frappe.ValidationError):
				get_scorm_playback.__wrapped__(["!=", ""])
		finally:
			frappe.set_user("Administrator")

	def test_a_control_a_student_who_may_play_writes_nothing_to_the_security_log(self):
		"""Read this before the three below. A recorder that catches nothing at all
		would call every one of them a pass."""
		answer, warnings = self._playback_and_warnings("learner")
		self.assertEqual(answer["launch_file"], LAUNCH_FILE)
		self.assertEqual(warnings, [])

	def test_the_sequential_gate_is_what_reaches_the_security_log(self):
		"""An enrolled student asking for a chapter the gate is holding shut is the one
		state here that says somebody routed around it."""
		frappe.db.set_value("LMS Course", self.course.name, "enforce_lesson_completion", 1)
		answer, warnings = self._playback_and_warnings("learner")

		self.assertEqual(answer["locked"], 1)
		self.assertEqual(len(warnings), 1)
		self.assertIn(self.chapter.name, warnings[0])
		self.assertIn(self.learner.name, warnings[0])

	def test_an_account_with_no_enrolment_writes_no_security_warning(self):
		"""This is the state the page renders as an invitation to enrol, so warning on
		it means a security warning per prospective student per chapter view."""
		answer, warnings = self._playback_and_warnings("outsider")

		self.assertEqual(answer["can_access"], 0)
		self.assertEqual(answer["locked"], 0)
		self.assertEqual(warnings, [])

	def test_a_chapter_whose_lesson_is_gone_writes_no_security_warning(self):
		"""delete_lesson removes the Lesson Reference and leaves the chapter standing.
		The endpoint still refuses the package — there is nothing to be enrolled in —
		but that is an authoring state and the person meeting it is usually the author.
		"""
		frappe.db.delete("Lesson Reference", {"parent": self.chapter.name})
		answer, warnings = self._playback_and_warnings("creator")

		self.assertIsNone(answer["lesson"])
		self.assertEqual(answer["can_access"], 0)
		self.assertEqual(warnings, [])
