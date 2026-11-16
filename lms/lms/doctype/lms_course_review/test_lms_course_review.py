# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import frappe

from lms.lms.html_sanitizer import sanitize_rich_text, to_plain_text
from lms.lms.test_helpers import BaseTestUtils
from lms.widgets import Widgets

TESTIMONIALS = "lms/lms/web_template/multiple_testimonials/multiple_testimonials.html"


class TestLMSCourseReview(BaseTestUtils):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		hash = frappe.generate_hash(length=6).lower()
		cls.instructor = cls._create_user(
			f"review-ins-{hash}@example.com", "Review", "Instructor", ["Course Creator"]
		).name
		cls.learner = cls._create_user(
			f"review-stu-{hash}@example.com", "Review", "Learner", ["LMS Student"]
		).name
		cls.course = cls._create_course(f"Review Course {hash}", instructor=cls.instructor).name
		cls._create_enrollment(cls.learner, cls.course)

	def _review(self, text):
		frappe.db.delete("LMS Course Review", {"course": self.course, "owner": self.learner})
		frappe.set_user(self.learner)
		try:
			doc = frappe.get_doc(
				{"doctype": "LMS Course Review", "course": self.course, "review": text, "rating": 1}
			).insert()
		finally:
			frappe.set_user("Administrator")
		return doc

	def test_a_review_is_stored_as_the_text_it_was_written_as(self):
		self.assertEqual(self._review("a & b <3 loved it").review, "a & b <3 loved it")

	def test_a_review_keeps_no_tags(self):
		for text in (
			"Great course <img src=x onerror=alert(1)",
			"Sign in <form action=x><input type=password><button>Go</button></form>",
			"&lt;b&gt;bold&lt;/b&gt;",
			"hi &amp;amp;amp;amp;lt;form action=x&amp;amp;amp;amp;gt;",
		):
			with self.subTest(text=text):
				stored = self._review(text).review
				self.assertNotIn("<img", stored)
				self.assertNotIn("<form", stored)
				self.assertNotIn("<b>", stored)

	def test_the_testimonials_block_prints_a_review_as_text(self):
		review = self._review("Loved it")
		frappe.db.set_value("LMS Course Review", review.name, "review", "<b>x</b> & <i>y</i>")
		html = frappe.render_template(
			TESTIMONIALS,
			{
				"title": "T",
				"widgets": Widgets(),
				"testimonials_table": [frappe._dict(testimonials=review.name)],
			},
		)
		self.assertIn("&lt;b&gt;x&lt;/b&gt; &amp; &lt;i&gt;y&lt;/i&gt;", html)
		self.assertNotIn("<b>x</b>", html)


class TestRichText(BaseTestUtils):
	def test_text_ending_in_an_unclosed_tag_is_cleaned(self):
		self.assertEqual(sanitize_rich_text("tail <img src=x onerror=alert(1)"), "tail ")

	def test_text_with_no_tag_is_kept(self):
		self.assertEqual(sanitize_rich_text("a & b"), "a & b")

	def test_deeply_encoded_text_is_cleaned_quickly(self):
		import time

		value = "&" + "amp;" * 10000 + "lt;form action=x&gt;"
		started = time.monotonic()
		text = to_plain_text(value)
		self.assertLess(time.monotonic() - started, 2)
		self.assertNotIn("<", text)

	def test_plain_text_keeps_what_was_typed(self):
		self.assertEqual(to_plain_text("2 < 3 & 4 > 1"), "2 < 3 & 4 > 1")


class TestAvatar(BaseTestUtils):
	def _render(self, full_name):
		member = frappe._dict(full_name=full_name, username="someone", user_image="/files/a.png?x=1&y=2")
		return frappe.render_template(
			"lms/lms/widgets/Avatar.html",
			{"member": member, "avatar_class": "avatar-small", "widgets": Widgets()},
		)

	def test_a_quote_in_a_name_stays_inside_the_title(self):
		html = self._render('Ann" data-x="1')
		self.assertNotIn('data-x="1"', html)
		self.assertIn('title="Ann&quot; data-x=&quot;1"', html)

	def test_a_stored_name_is_not_escaped_twice(self):
		self.assertIn('title="Tom &amp; Jerry"', self._render("Tom &amp; Jerry"))
