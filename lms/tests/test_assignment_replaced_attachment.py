import io

import frappe
from pypdf import PdfWriter

from lms.lms.test_helpers import BaseTestUtils


def pdf_bytes() -> bytes:
	"""A real one-page PDF, different every call: frappe validates uploaded PDFs."""
	writer = PdfWriter()
	writer.add_blank_page(width=72, height=72)
	writer.add_metadata({"/Title": frappe.generate_hash()})
	buffer = io.BytesIO()
	writer.write(buffer)
	return buffer.getvalue()


class TestReplacedAttachment(BaseTestUtils):
	"""A new upload replaces the submission's file: the old File is deleted."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6)
		cls.student = cls._create_user(
			f"replace.student.{hash}@example.com", "Replace", "Student", ["LMS Student"]
		)
		cls.assignment = cls._create_assignment(title=f"Replaced Attachment Assignment {hash}")
		frappe.db.set_value("LMS Assignment", cls.assignment.name, "type", "PDF")
		instructor = cls._create_user(
			f"replace.instructor.{hash}@example.com", "Replace", "Instructor", ["Course Creator"]
		)
		course = cls._create_course(title=f"Replaced Attachment Course {hash}", instructor=instructor.name)
		cls._place_in_lesson(course.name, "LMS Assignment", cls.assignment.name)
		cls._create_enrollment(cls.student.name, course.name)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _upload(self, file_name):
		frappe.set_user(self.student.name)
		# nosemgrep: lms-unjustified-ignore-permissions - stands in for upload_file, which owns the row the same way
		return frappe.get_doc(
			{
				"doctype": "File",
				"file_name": file_name,
				"is_private": 1,
				"content": pdf_bytes(),
			}
		).insert(ignore_permissions=True)

	def _submit(self, file):
		doc = frappe.new_doc("LMS Assignment Submission")
		doc.update(
			{
				"assignment": self.assignment.name,
				"member": self.student.name,
				"assignment_attachment": file.file_url,
			}
		)
		return doc.insert()

	def _attached_to(self, file):
		return frappe.db.get_value("File", file.name, "attached_to_name")

	def test_a_new_upload_deletes_the_replaced_file(self):
		first = self._upload("first.pdf")
		doc = self._submit(first)
		self.assertEqual(self._attached_to(first), doc.name)

		second = self._upload("second.pdf")
		doc.assignment_attachment = second.file_url
		doc.save()

		self.assertFalse(frappe.db.exists("File", first.name))
		self.assertEqual(self._attached_to(second), doc.name)

	def test_a_learner_cant_replace_a_graded_file(self):
		first = self._upload("graded.pdf")
		doc = self._submit(first)
		frappe.db.set_value("LMS Assignment Submission", doc.name, "status", "Pass")
		doc.reload()
		doc.assignment_attachment = self._upload("swapped.pdf").file_url
		with self.assertRaisesRegex(frappe.ValidationError, "graded"):
			doc.save()
		self.assertTrue(frappe.db.exists("File", first.name))

	def test_saving_without_a_new_file_keeps_it(self):
		first = self._upload("kept.pdf")
		doc = self._submit(first)
		doc.answer = "A note"
		doc.save()
		self.assertTrue(frappe.db.exists("File", first.name))

	def test_a_file_attached_elsewhere_is_kept(self):
		first = self._upload("shared.pdf")
		doc = self._submit(first)
		frappe.db.set_value("File", first.name, "attached_to_field", "answer")

		doc.assignment_attachment = self._upload("next.pdf").file_url
		doc.save()

		self.assertTrue(frappe.db.exists("File", first.name))
