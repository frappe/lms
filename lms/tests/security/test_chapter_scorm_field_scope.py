# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

import frappe
from frappe.client import get as client_get

from lms.lms.test_helpers import BaseTestUtils

# Asserted live in setUp rather than trusted. LMS Student is on every actor:
# add_lms_student_role is registered on User.before_insert and appends it
# unconditionally. The hash suffix is what keeps _create_user from reusing a stale User.
ACTOR_ROLES = {
	"outsider": {"All", "Guest", "LMS Student"},
	"learner": {"All", "Guest", "LMS Student"},
	"creator": {"All", "Course Creator", "Guest", "LMS Student"},
	"moderator": {"All", "Guest", "LMS Student", "Moderator"},
}

AUTHORING_ACTORS = ("creator", "moderator", "manager")

# The four fields that name where a SCORM package lives on this site.
SCORM_FIELDS = ("manifest_file", "launch_file", "scorm_package", "scorm_package_path")

LAUNCH_FILE = "/scorm/canary-course/canary-chapter/index.html"
MANIFEST_FILE = "/scorm/canary-course/canary-chapter/imsmanifest.xml"
PACKAGE_PATH = "/scorm/canary-course/canary-chapter"

ABSENT = "<absent>"


class ScormChapterFixture(BaseTestUtils):
	"""One course with an intro chapter and a SCORM chapter after it, five actors. Shared
	by all three suites so the row the permlevel hides is the row the endpoint serves.
	Administrator is never an actor: it skips permlevels and agrees with anything."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		hash = frappe.generate_hash(length=6)
		self.outsider = self._create_user(f"csf-o-{hash}@example.com", "Ossie", "Outsider", [])
		self.learner = self._create_user(f"csf-l-{hash}@example.com", "Lena", "Learner", [])
		self.creator = self._create_user(f"csf-c-{hash}@example.com", "Cara", "Creator", ["Course Creator"])
		self.moderator = self._create_user(f"csf-m-{hash}@example.com", "Mo", "Moderator", ["Moderator"])
		self.manager = self._create_user(
			f"csf-a-{hash}@example.com", "Sam", "Manager", ["System Manager"], user_type="System User"
		)
		self.course = self._create_course(title=f"SCORM Field Scope {hash}", instructor=self.creator.name)
		self.chapter = self._create_scorm_chapter(hash)
		self._create_enrollment(self.learner.name, self.course.name)
		self._assert_actor_roles()

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _create_scorm_chapter(self, hash):
		"""All four SCORM fields, behind an ordinary chapter so the course can express a
		locked SCORM chapter. Save order is load-bearing: saving the in-hand chapter after
		_create_lesson_reference would delete the child row it just inserted."""
		intro = self._create_chapter(f"Intro Chapter {hash}", self.course.name)
		intro_lesson = self._create_lesson(f"Intro Lesson {hash}", intro.name, self.course.name)
		self._create_lesson_reference(intro.name, intro_lesson.name)
		self._create_chapter_reference(self.course.name, intro.name, idx=1)

		chapter = self._create_chapter(f"SCORM Chapter {hash}", self.course.name)
		self.package = self._create_package_file(hash).name
		chapter.update(
			{
				"is_scorm_package": 1,
				"scorm_package": self.package,
				"scorm_package_path": PACKAGE_PATH,
				"manifest_file": MANIFEST_FILE,
				"launch_file": LAUNCH_FILE,
			}
		)
		chapter.save()

		lesson = self._create_lesson(f"SCORM Lesson {hash}", chapter.name, self.course.name)
		self._create_lesson_reference(chapter.name, lesson.name)
		self._create_chapter_reference(self.course.name, chapter.name, idx=2)
		self.lesson = lesson
		return chapter

	def _create_package_file(self, hash):
		"""`scorm_package` is a Link to File and save() validates every non-empty Link,
		so the fixture needs a File row that exists rather than a made-up name."""
		return frappe.get_doc(
			{
				"doctype": "File",
				"file_name": f"scorm-field-scope-{hash}.zip",
				"is_private": 1,
				"content": "not a real package; this suite never extracts one",
			}
		).insert()

	def _stored_scorm_values(self):
		"""What each SCORM field actually holds, with no permission layer applied. The
		controls weigh reads against this, not against "not absent": a fixture that stored
		nothing would answer None everywhere and pass a presence-only control."""
		return {
			"manifest_file": MANIFEST_FILE,
			"launch_file": LAUNCH_FILE,
			"scorm_package_path": PACKAGE_PATH,
			"scorm_package": self.package,
		}

	def _assert_actor_roles(self):
		for label, expected in ACTOR_ROLES.items():
			self.assertEqual(
				set(frappe.get_roles(getattr(self, label).name)),
				expected,
				f"{label}: holds roles this suite's expectations were not derived against",
			)
		# Membership, not an exact set: frappe grants a desk account further roles that
		# differ by version, so an exact set would be a version assertion in disguise.
		# What matters is that this actor reaches the fields as an admin, not an author.
		manager_roles = set(frappe.get_roles(self.manager.name))
		self.assertIn("System Manager", manager_roles)
		self.assertNotIn("Moderator", manager_roles)
		self.assertNotIn("Course Creator", manager_roles)

	def _single_doc_read(self, label):
		"""The REST single-doc path. `frappe.get_doc` runs no permission check at all,
		so the read has to go through the endpoint that applies field-level ones."""
		frappe.set_user(getattr(self, label).name)
		try:
			return client_get("Course Chapter", self.chapter.name)
		finally:
			frappe.set_user("Administrator")

	def _list_read(self, label):
		"""`frappe.get_list`, never `frappe.get_all` — get_all sets
		ignore_permissions=True and would bypass the rule under test."""
		frappe.set_user(getattr(self, label).name)
		try:
			rows = frappe.get_list(
				"Course Chapter",
				filters={"name": self.chapter.name},
				fields=["name", "title", "course", *SCORM_FIELDS],
			)
			return rows[0] if rows else None
		finally:
			frappe.set_user("Administrator")


class TestChapterScormFieldScope(ScormChapterFixture):
	"""Where a SCORM package lives is not something every account may read. Every account
	holds LMS Student, which had read at permlevel 0, so the launch URL, manifest URL,
	package File and extraction path were one frappe.client.get — or get_list — away."""

	def test_a_control_every_authoring_role_still_reads_the_scorm_fields(self):
		"""Read this before the refusals below. A red phase where the control also fails
		is a broken environment, not a finding — and a permlevel with no DocPerm row at
		that level hides the fields from the authors too, silently."""
		stored = self._stored_scorm_values()
		for label in AUTHORING_ACTORS:
			document = self._single_doc_read(label)
			row = self._list_read(label)
			for field, value in stored.items():
				self.assertEqual(
					document.get(field, ABSENT),
					value,
					f"{label} lost {field} on the single-doc read; chapter authors need it",
				)
				self.assertEqual(
					row.get(field, ABSENT),
					value,
					f"{label} lost {field} on the list read; chapter authors need it",
				)

	def test_a_control_a_student_still_reads_the_chapter_row(self):
		"""This narrows four fields, not access to the chapter."""
		document = self._single_doc_read("outsider")
		self.assertEqual(document.get("title"), self.chapter.title)
		self.assertEqual(document.get("course"), self.course.name)
		row = self._list_read("outsider")
		self.assertEqual(row.get("name"), self.chapter.name)
		self.assertEqual(row.get("title"), self.chapter.title)

	def test_a_student_gets_no_scorm_fields_on_the_single_doc_read(self):
		document = self._single_doc_read("outsider")
		for field in SCORM_FIELDS:
			self.assertEqual(
				document.get(field, ABSENT),
				ABSENT,
				f"a bare account read {field} through frappe.client.get",
			)

	def test_a_student_gets_no_scorm_fields_on_a_list_read(self):
		row = self._list_read("outsider")
		for field in SCORM_FIELDS:
			self.assertEqual(
				row.get(field, ABSENT),
				ABSENT,
				f"a bare account read {field} through frappe.get_list, which no "
				"single-doc gate is consulted on",
			)

	def test_the_enrolled_student_is_refused_on_the_document_read_too(self):
		"""And that is the point. The document read carries no lock check and no
		enrolment check, so it cannot be the path a player reads the launch file on.
		get_scorm_playback is."""
		document = self._single_doc_read("learner")
		self.assertEqual(document.get("launch_file", ABSENT), ABSENT)
		self.assertEqual(document.get("title"), self.chapter.title)
