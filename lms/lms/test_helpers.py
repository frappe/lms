import frappe
from frappe.tests import UnitTestCase
from frappe.utils import add_days, nowdate

from lms.lms.doctype.lms_certificate.lms_certificate import get_default_certificate_template


class BaseTestUtils(UnitTestCase):
	"""
	Base class with helper methods for creating test data.
	Subclasses should call super().setUp() and super().tearDown().
	"""

	def setUp(self):
		self.cleanup_items = []

	def tearDown(self):
		for item_type, item_name in reversed(self.cleanup_items):
			if frappe.db.exists(item_type, item_name):
				try:
					frappe.delete_doc(item_type, item_name, force=True)
				except Exception:
					pass

	def _create_user(self, email, first_name, last_name, roles, user_type="Website User"):
		if frappe.db.exists("User", email):
			return frappe.get_doc("User", email)

		user = frappe.new_doc("User")
		user.update(
			{
				"email": email,
				"first_name": first_name,
				"last_name": last_name,
				"user_type": user_type,
				"send_welcome_email": False,
			}
		)
		for role in roles:
			user.append("roles", {"role": role})
		user.save()
		self.cleanup_items.append(("User", user.name))
		return user

	def _create_course(self, title="Utility Course", instructor="frappe@example.com"):
		existing = frappe.db.exists("LMS Course", {"title": title})
		if existing:
			return frappe.get_doc("LMS Course", existing)

		course = frappe.new_doc("LMS Course")
		course.update(
			{
				"title": title,
				"short_introduction": "A course to test utilities of Frappe Learning",
				"description": "This is a detailed description of the Utility Course.",
				"tags": "Frappe,Learning,Utility",
				"published": 1,
				"instructors": [{"instructor": instructor}],
			}
		)
		course.save()
		self.cleanup_items.append(("LMS Course", course.name))
		return course

	def _create_chapter(self, title, course):
		if not title:
			title = f"Course Chapter {frappe.generate_hash()}"

		existing = frappe.db.exists("Course Chapter", {"course": course, "title": title})
		if existing:
			return frappe.get_doc("Course Chapter", existing)

		chapter = frappe.new_doc("Course Chapter")
		chapter.update(
			{
				"course": course,
				"title": title,
			}
		)
		chapter.save()
		self.cleanup_items.append(("Course Chapter", chapter.name))
		return chapter

	def _create_lesson(self, title, chapter, course):
		existing = frappe.db.exists("Course Lesson", {"course": course, "title": title})
		if existing:
			return frappe.get_doc("Course Lesson", existing)

		lesson = frappe.new_doc("Course Lesson")
		lesson.update(
			{
				"course": course,
				"chapter": chapter,
				"title": title,
				"content": '{"time":1765194986690,"blocks":[{"id":"dkLzbW14ds","type":"markdown","data":{"text":"This is a simple content for the current lesson."}},{"id":"KBwuWPc8rV","type":"markdown","data":{"text":""}}],"version":"2.29.0"}',
			}
		)
		lesson.save()
		self.cleanup_items.append(("Course Lesson", lesson.name))
		return lesson

	def _create_lesson_reference(self, chapter, lesson):
		lesson_ref = frappe.get_doc(
			{
				"doctype": "Lesson Reference",
				"lesson": lesson,
				"parent": chapter,
				"parenttype": "Course Chapter",
				"parentfield": "lessons",
				"idx": 1,
			}
		)
		lesson_ref.insert()
		self.cleanup_items.append(("Lesson Reference", lesson_ref.name))
		return lesson_ref

	def _create_chapter_reference(self, course, chapter, idx=1):
		chapter_ref = frappe.get_doc(
			{
				"doctype": "Chapter Reference",
				"chapter": chapter,
				"parent": course,
				"parenttype": "LMS Course",
				"parentfield": "chapters",
				"idx": idx,
			}
		)
		chapter_ref.insert()
		self.cleanup_items.append(("Chapter Reference", chapter_ref.name))
		return chapter_ref

	def _create_enrollment(self, member, course):
		existing = frappe.db.exists("LMS Enrollment", {"course": course, "member": member})
		if existing:
			return frappe.get_doc("LMS Enrollment", existing)

		enrollment = frappe.new_doc("LMS Enrollment")
		enrollment.update({"member": member, "course": course})
		enrollment.insert()
		self.cleanup_items.append(("LMS Enrollment", enrollment.name))
		return enrollment

	def _create_progress(self, member, course, lesson):
		progress = frappe.new_doc("LMS Course Progress")
		progress.update({"member": member, "course": course, "lesson": lesson})
		progress.insert()
		self.cleanup_items.append(("LMS Course Progress", progress.name))
		return progress

	def _create_evaluator(self, evaluator_email="frappe@example.com"):
		if frappe.db.exists("Course Evaluator", evaluator_email):
			return frappe.get_doc("Course Evaluator", evaluator_email)

		evaluator = frappe.new_doc("Course Evaluator")
		evaluator.update(
			{
				"evaluator": evaluator_email,
				"schedule": [
					{"day": "Monday", "start_time": "10:00", "end_time": "12:00"},
					{"day": "Wednesday", "start_time": "14:00", "end_time": "16:00"},
				],
				"unavailable_from": add_days(nowdate(), 5),
				"unavailable_to": add_days(nowdate(), 12),
			}
		)
		evaluator.save()
		self.cleanup_items.append(("Course Evaluator", evaluator.name))
		return evaluator

	def _create_batch(
		self,
		course,
		instructor="frappe@example.com",
		title="Utility Training",
		evaluator="frappe@example.com",
	):
		existing = frappe.db.exists("LMS Batch", {"title": title})
		if existing:
			return frappe.get_doc("LMS Batch", existing)

		batch = frappe.new_doc("LMS Batch")
		batch.update(
			{
				"title": title,
				"start_date": nowdate(),
				"end_date": add_days(nowdate(), 10),
				"start_time": "09:00:00",
				"end_time": "11:00:00",
				"timezone": "Asia/Kolkata",
				"description": "Batch for Utility Course Training",
				"batch_details": "This batch is created to test utility functions.",
				"evaluation_end_date": add_days(nowdate(), 120),
				"instructors": [{"instructor": instructor}],
				"courses": [{"course": course, "evaluator": evaluator}],
			}
		)
		batch.save()
		self.cleanup_items.append(("LMS Batch", batch.name))
		return batch

	def _add_rating(self, course, member, rating, review_text):
		existing = frappe.db.exists("LMS Course Review", {"course": course, "owner": member})
		if existing:
			return frappe.get_doc("LMS Course Review", existing)

		frappe.session.user = member
		review_doc = frappe.new_doc("LMS Course Review")
		review_doc.update(
			{
				"course": course,
				"rating": rating,
				"review": review_text,
			}
		)
		review_doc.save()
		self.cleanup_items.append(("LMS Course Review", review_doc.name))
		frappe.session.user = "Administrator"
		return review_doc

	def _create_certificate(self, course, member):
		existing = frappe.db.exists("LMS Certificate", {"course": course, "member": member})
		if existing:
			return frappe.get_doc("LMS Certificate", existing)

		certificate = frappe.new_doc("LMS Certificate")
		certificate.update(
			{
				"course": course,
				"member": member,
				"issue_date": frappe.utils.nowdate(),
				"template": get_default_certificate_template(),
				"published": 1,
			}
		)
		certificate.save()
		self.cleanup_items.append(("LMS Certificate", certificate.name))
		return certificate
