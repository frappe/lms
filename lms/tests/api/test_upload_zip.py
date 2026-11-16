import io
import zipfile

import frappe
from werkzeug.test import EnvironBuilder
from werkzeug.wrappers import Request

from lms.lms.api import upload_zip
from lms.lms.test_helpers import BaseTestUtils


def _zip_bytes() -> bytes:
	buffer = io.BytesIO()
	with zipfile.ZipFile(buffer, "w") as archive:
		archive.writestr("imsmanifest.xml", "<manifest />")
	return buffer.getvalue()


class TestUploadZip(BaseTestUtils):
	"""upload_file refuses a ZIP from anyone without desk access, which is every LMS
	role, so course import and SCORM chapters upload through this instead (#2690)."""

	def setUp(self):
		super().setUp()
		self.creator = self._create_user("zip-creator@example.com", "Zip", "Creator", ["Course Creator"])
		self.moderator = self._create_user("zip-moderator@example.com", "Zip", "Moderator", ["Moderator"])
		self.student = self._create_user("zip-student@example.com", "Zip", "Student", ["LMS Student"])
		self._previous_request = getattr(frappe.local, "request", None)

	def tearDown(self):
		frappe.local.request = self._previous_request
		frappe.set_user("Administrator")
		super().tearDown()

	def _upload_as(self, user, content, filename="course.zip"):
		frappe.local.request = Request(
			EnvironBuilder(method="POST", data={"file": (io.BytesIO(content), filename)}).get_environ()
		)
		frappe.set_user(user)
		return upload_zip()

	def test_the_roles_that_build_courses_can_upload_a_zip(self):
		for user in (self.creator.name, self.moderator.name):
			with self.subTest(user=user):
				file = self._upload_as(user, _zip_bytes())

				row = frappe.db.get_value(
					"File", file["name"], ["is_private", "owner", "file_url"], as_dict=True
				)
				self.assertEqual((row.is_private, row.owner), (1, user))
				self.assertTrue(row.file_url.startswith("/private/files/"))
				self.assertTrue(file["file_name"].endswith(".zip"))

	def test_other_users_cannot(self):
		with self.assertRaises(frappe.PermissionError):
			self._upload_as(self.student.name, _zip_bytes())

	def test_only_a_zip_archive_is_accepted(self):
		cases = {
			"named something else": (_zip_bytes(), "course.html"),
			"not an archive inside": (b"<script>alert(1)</script>", "course.zip"),
		}
		for case, (content, filename) in cases.items():
			with self.subTest(case=case), self.assertRaises(frappe.ValidationError):
				self._upload_as(self.creator.name, content, filename)
