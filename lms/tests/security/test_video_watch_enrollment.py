import frappe
from frappe.tests.test_api import FrappeAPITestCase

from lms.lms.api import track_video_watch_duration
from lms.lms.test_helpers import BaseTestUtils


class TestVideoWatchEnrollment(BaseTestUtils, FrappeAPITestCase):
	"""track_video_watch_duration must require lesson access (VULN-2026-FRAPPE-LMS-002)."""

	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"vinstr-{hash}@example.com", "Ida", "Instr", ["Course Creator", "Moderator"]
		)
		self.enrolled = self._create_user(f"venr-{hash}@example.com", "Ed", "Enrolled", ["LMS Student"])
		self.outsider = self._create_user(f"vout-{hash}@example.com", "Ozzy", "Outsider", ["LMS Student"])

		self.course = self._create_course(title=f"Video Course {hash}", instructor=self.instructor.email)
		self.chapter = self._create_chapter(f"VChapter {hash}", self.course.name)
		self.lesson = self._create_lesson(f"VLesson {hash}", self.chapter.name, self.course.name)
		self._create_enrollment(self.enrolled.email, self.course.name)
		self.videos = [{"source": "https://example.com/v.mp4", "watch_time": 999}]

	def _watch_records(self, member):
		return frappe.db.count("LMS Video Watch Duration", {"lesson": self.lesson.name, "member": member})

	def _call(self, user):
		frappe.session.user = user
		try:
			track_video_watch_duration(self.lesson.name, self.videos)
		finally:
			frappe.session.user = "Administrator"

	def test_non_enrolled_user_cannot_track(self):
		with self.assertRaises(frappe.PermissionError):
			self._call(self.outsider.email)
		self.assertEqual(self._watch_records(self.outsider.email), 0)

	def test_enrolled_user_can_track(self):
		self._call(self.enrolled.email)
		self.assertEqual(self._watch_records(self.enrolled.email), 1)

	def test_non_string_lesson_rejected(self):
		# Rejected either by Frappe's whitelist type validation (FrappeTypeError,
		# from the `lesson: str` annotation) or by our own isinstance guard.
		frappe.session.user = self.enrolled.email
		try:
			with self.assertRaises((frappe.ValidationError, frappe.FrappeTypeError)):
				track_video_watch_duration(["not", "a", "string"], self.videos)
		finally:
			frappe.session.user = "Administrator"
