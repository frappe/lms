import frappe
from frappe.utils import nowdate

from lms.lms.onboarding import DEMO_QUIZ_TITLE, SAMPLE_COURSE_TITLE, get_onboarding_facts
from lms.lms.test_helpers import BaseTestUtils

FLAG_KEYS = {
	"has_course",
	"has_chapter",
	"has_lesson",
	"has_quiz",
	"has_programming_exercise",
	"has_assignment",
	"has_assessment_in_lesson",
	"has_course_pricing",
	"has_published_course",
	"has_imported_learners",
	"has_email_account",
	"has_batch",
	"has_batch_details",
	"has_zoom_account",
	"has_google_api",
	"has_google_calendar",
	"has_meet_account",
	"has_live_class",
	"has_published_batch",
}


class TestOnboardingFacts(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.admin = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"]
		)
		self._clear_onboarding_records()

	def _clear_onboarding_records(self):
		for doctype in (
			"LMS Live Class",
			"LMS Batch Enrollment",
			"Batch Course",
			"LMS Batch",
			"Course Lesson",
			"Course Chapter",
			"LMS Course",
			"LMS Quiz",
			"LMS Assignment",
			"LMS Programming Exercise",
			"LMS Lesson Assessment",
			"LMS Zoom Settings",
			"LMS Google Meet Settings",
			"Google Calendar",
			"Data Import",
			"Email Account",
		):
			frappe.db.delete(doctype)
		self._set_google_settings(enable=0, client_id=None, client_secret=None)

	def _facts(self, course=None):
		return get_onboarding_facts(course)

	# Guards: a Guest reading the site's setup facts. Introduced in this branch (feat/onboarding-flows, PR
	# pending); test added there to pin the auth gate.
	def test_guest_is_rejected(self):
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			get_onboarding_facts()

	# Guards: a Moderator without System Manager reading site-wide setup facts. Introduced in this branch
	# (feat/onboarding-flows, PR pending); test added there to pin the role gate.
	def test_moderator_without_system_manager_is_rejected(self):
		frappe.set_user(self.admin.name)
		with self.assertRaises(frappe.PermissionError):
			get_onboarding_facts()

	# Guards: a renamed or dropped fact key that the frontend flows read by name. Introduced in this
	# branch (feat/onboarding-flows, PR pending); test added there to keep the payload shape fixed.
	def test_returns_exact_key_set(self):
		self.assertEqual(set(self._facts()), FLAG_KEYS | {"first_course", "first_chapter", "first_batch"})

	# Guards: a step showing as done on a fresh site. Introduced in this branch (feat/onboarding-flows, PR
	# pending); test added there to pin the all-false baseline.
	def test_clean_site_has_no_facts(self):
		facts = self._facts()
		self.assertIsNone(facts["first_course"])
		self.assertIsNone(facts["first_chapter"])
		self.assertIsNone(facts["first_batch"])
		for key in FLAG_KEYS:
			self.assertIs(facts[key], False, key)

	# Guards: the seeded sample course ticking the admin's own course steps. Introduced in this branch
	# (feat/onboarding-flows, PR pending); test added there to keep the sample out of every course fact.
	def test_sample_course_is_ignored(self):
		sample = self._create_course(title=SAMPLE_COURSE_TITLE)
		chapter = self._create_chapter("Sample chapter", sample.name)
		self._create_lesson("Sample lesson", chapter.name, sample.name)

		facts = self._facts()
		self.assertIsNone(facts["first_course"])
		self.assertFalse(facts["has_course"])
		self.assertFalse(facts["has_chapter"])
		self.assertFalse(facts["has_lesson"])
		self.assertFalse(facts["has_published_course"])

	# Guards: course facts and first_chapter read from the wrong course or outline position. Introduced in
	# this branch (feat/onboarding-flows, PR pending); test added there to follow one course from draft to
	# published.
	def test_course_facts_follow_the_only_course(self):
		course = self._create_course(title="Onboarding Course")
		frappe.db.set_value("LMS Course", course.name, {"published": 0, "paid_course": 0, "course_price": 0})

		facts = self._facts()
		self.assertEqual(facts["first_course"], course.name)
		self.assertTrue(facts["has_course"])
		self.assertFalse(facts["has_chapter"])
		self.assertFalse(facts["has_lesson"])
		self.assertFalse(facts["has_course_pricing"])
		self.assertFalse(facts["has_published_course"])

		self.assertIsNone(facts["first_chapter"])

		later = self._create_chapter("Onboarding chapter two", course.name)
		chapter = self._create_chapter("Onboarding chapter", course.name)
		self._create_chapter_reference(course.name, later.name, idx=2)
		self._create_chapter_reference(course.name, chapter.name, idx=1)
		self._create_lesson("Onboarding lesson", chapter.name, course.name)
		frappe.db.set_value(
			"LMS Course", course.name, {"published": 1, "paid_course": 1, "course_price": 499}
		)

		facts = self._facts()
		self.assertEqual(facts["first_chapter"], chapter.name)
		self.assertTrue(facts["has_chapter"])
		self.assertTrue(facts["has_lesson"])
		self.assertTrue(facts["has_course_pricing"])
		self.assertTrue(facts["has_published_course"])

	# Guards: Set pricing ticking when only one of paid_course and course_price is set. Introduced in this
	# branch (feat/onboarding-flows, PR pending); test added there to require both.
	def test_pricing_needs_a_paid_course_with_a_price(self):
		course = self._create_course(title="Onboarding Course")
		frappe.db.set_value("LMS Course", course.name, {"paid_course": 1, "course_price": 0})
		self.assertFalse(self._facts()["has_course_pricing"])

		frappe.db.set_value("LMS Course", course.name, {"paid_course": 0, "course_price": 499})
		self.assertFalse(self._facts()["has_course_pricing"])

	# Guards: the fallback course going back to the oldest instead of the newest. Introduced in this branch
	# (feat/onboarding-flows, PR pending); test added there to pin the fallback order.
	def test_without_a_recorded_course_the_newest_is_followed(self):
		older = self._create_course(title="Onboarding Course")
		newer = self._create_course(title="Onboarding Course Two")
		self._set_creation(older.name, "2026-01-01 10:00:00")
		self._set_creation(newer.name, "2026-01-02 10:00:00")
		self.assertEqual(self._facts()["first_course"], newer.name)

	# Guards: steps ticking from another course's chapters, lessons or price. Introduced in this branch
	# (feat/onboarding-flows, PR pending); test added there so the publish flow's own course wins.
	def test_a_recorded_course_is_followed_over_the_oldest_and_the_newest(self):
		oldest = self._create_course(title="Onboarding Course")
		recorded = self._create_course(title="Onboarding Course Two")
		newest = self._create_course(title="Onboarding Course Three")
		for course in (oldest, newest):
			chapter = self._create_chapter(f"{course.title} chapter", course.name)
			self._create_chapter_reference(course.name, chapter.name, idx=1)
			self._create_lesson(f"{course.title} lesson", chapter.name, course.name)
			frappe.db.set_value("LMS Course", course.name, {"paid_course": 1, "course_price": 499})
		self._set_creation(oldest.name, "2026-01-01 10:00:00")
		self._set_creation(recorded.name, "2026-01-02 10:00:00")
		self._set_creation(newest.name, "2026-01-03 10:00:00")

		facts = self._facts(recorded.name)
		self.assertEqual(facts["first_course"], recorded.name)
		self.assertIsNone(facts["first_chapter"])
		self.assertFalse(facts["has_chapter"])
		self.assertFalse(facts["has_lesson"])
		self.assertFalse(facts["has_course_pricing"])

	# Guards: Publish ticking because some older course is published. Introduced in this branch
	# (feat/onboarding-flows, PR pending); test added there to read published from the target course only.
	def test_a_published_old_course_does_not_publish_an_unpublished_target(self):
		older = self._create_course(title="Onboarding Course")
		newer = self._create_course(title="Onboarding Course Two")
		frappe.db.set_value("LMS Course", older.name, "published", 1)
		frappe.db.set_value("LMS Course", newer.name, "published", 0)
		self._set_creation(older.name, "2026-01-01 10:00:00")
		self._set_creation(newer.name, "2026-01-02 10:00:00")
		self.assertFalse(self._facts(newer.name)["has_published_course"])
		self.assertTrue(self._facts(older.name)["has_published_course"])

	# Guards: a deleted, empty or sample-course target blanking the course facts. Introduced in this branch
	# (feat/onboarding-flows, PR pending); test added there to pin the fallback.
	def test_an_unknown_or_sample_course_falls_back_to_the_newest(self):
		course = self._create_course(title="Onboarding Course")
		sample = self._create_course(title=SAMPLE_COURSE_TITLE)
		for target in ("no-such-course", sample.name, ""):
			self.assertEqual(self._facts(target)["first_course"], course.name, target)

	# Guards: a list or dict `course` reaching the filters as an operator. frappe's type check runs first, so
	# __wrapped__ reaches the explicit guard. Introduced in this branch (feat/onboarding-flows, PR pending);
	# test added there to pin that guard.
	def test_a_course_that_is_not_a_string_is_rejected(self):
		unchecked = get_onboarding_facts.__wrapped__
		for target in (["!=", ""], {"name": "x"}, 1):
			with self.assertRaises(frappe.ValidationError):
				unchecked(target)

	# Guards: the seeded demo quiz ticking Add a quiz. Introduced in this branch (feat/onboarding-flows,
	# PR pending); test added there to exclude it by title.
	def test_quiz_counts_but_the_demo_quiz_does_not(self):
		self._insert_quiz(DEMO_QUIZ_TITLE)
		self.assertFalse(self._facts()["has_quiz"])

		self._insert_quiz("Onboarding quiz")
		self.assertTrue(self._facts()["has_quiz"])

	# Guards: the Add assessments flow missing an exercise or assignment the site already has. Introduced
	# in this branch (feat/onboarding-flows, PR pending); test added there to pin both facts.
	def test_programming_exercise_and_assignment_count(self):
		facts = self._facts()
		self.assertFalse(facts["has_programming_exercise"])
		self.assertFalse(facts["has_assignment"])

		self._create_programming_exercise("Onboarding exercise")
		self._create_assignment("Onboarding assignment")
		facts = self._facts()
		self.assertTrue(facts["has_programming_exercise"])
		self.assertTrue(facts["has_assignment"])

	# Guards: the last Add assessments step missing an assessment placed in a lesson. Introduced in this
	# branch (feat/onboarding-flows, PR pending); test added there to read the lesson placement index.
	def test_assessment_in_a_lesson_counts(self):
		course = self._create_course(title="Onboarding Course")
		self.assertFalse(self._facts()["has_assessment_in_lesson"])

		assignment = self._create_assignment("Onboarding assignment")
		self._place_in_lesson(course.name, "LMS Assignment", assignment.name)
		self.assertTrue(self._facts()["has_assessment_in_lesson"])

	# Guards: instructor notes ticking the student-facing assessment step. Introduced in this branch
	# (feat/onboarding-flows, PR pending); test added there to skip instructor_only placements.
	def test_an_instructor_only_assessment_does_not_count(self):
		course = self._create_course(title="Onboarding Course")
		assignment = self._create_assignment("Onboarding assignment")
		self._place_in_lesson(course.name, "LMS Assignment", assignment.name, instructor_only=True)
		self.assertFalse(self._facts()["has_assessment_in_lesson"])

	# Guards: the sample course's demo quiz ticking the assessment-in-lesson step. Introduced in this
	# branch (feat/onboarding-flows, PR pending); test added there to exclude sample-course lessons.
	def test_the_sample_course_assessments_do_not_count(self):
		sample = self._create_course(title=SAMPLE_COURSE_TITLE)
		quiz = self._insert_quiz(DEMO_QUIZ_TITLE)
		self._place_in_lesson(sample.name, "LMS Quiz", quiz.name)
		self.assertFalse(self._facts()["has_assessment_in_lesson"])

	# Guards: batch details, live class or published ticking before the batch has them. Introduced in this
	# branch (feat/onboarding-flows, PR pending); test added there to follow one batch through each step.
	def test_batch_facts_follow_the_first_batch(self):
		course = self._create_course(title="Onboarding Course")
		self._create_evaluator()
		batch = self._create_batch(course.name, title="Onboarding Batch")
		frappe.db.set_value("LMS Batch", batch.name, "published", 0)

		facts = self._facts()
		self.assertEqual(facts["first_batch"], batch.name)
		self.assertTrue(facts["has_batch"])
		self.assertFalse(facts["has_batch_details"])
		self.assertFalse(facts["has_live_class"])
		self.assertFalse(facts["has_published_batch"])

		self._insert_live_class(batch.name)
		frappe.db.set_value("LMS Batch", batch.name, {"published": 1, "meta_image": "/files/batch.png"})

		facts = self._facts()
		self.assertTrue(facts["has_batch_details"])
		self.assertTrue(facts["has_live_class"])
		self.assertTrue(facts["has_published_batch"])

	# Guards: a failed, pending or non-User import ticking Import learners. Introduced in this branch
	# (feat/onboarding-flows, PR pending); test added there to count only User imports that wrote rows.
	def test_imported_learners_need_a_finished_user_import(self):
		for status in ("Pending", "Error", "Timed Out"):
			self._insert_data_import("User", status)
		self._insert_data_import("LMS Course", "Success")
		self.assertFalse(self._facts()["has_imported_learners"])

		for status in ("Partial Success", "Success"):
			frappe.db.delete("Data Import", {"reference_doctype": "User", "status": ["like", "%Success"]})
			self._insert_data_import("User", status)
			self.assertTrue(self._facts()["has_imported_learners"], status)

	# Guards: an incoming-only account ticking the email setup step. Introduced in this branch
	# (feat/onboarding-flows, PR pending); test added there to require enable_outgoing.
	def test_email_account_needs_outgoing_enabled(self):
		self._insert_email_account("Support", "support@school.test", enable_outgoing=0)
		self.assertFalse(self._facts()["has_email_account"])

		self._insert_email_account("Outgoing", "hello@school.test", enable_outgoing=1)
		self.assertTrue(self._facts()["has_email_account"])

	# Guards: frappe's notifications@example.com fallback sender counting as an email setup. Introduced in
	# this branch (feat/onboarding-flows, PR pending); test added there to ignore placeholder accounts.
	def test_placeholder_notifications_account_does_not_count(self):
		self._insert_email_account("Notifications", "notifications@example.com", enable_outgoing=1)
		self.assertFalse(self._facts()["has_email_account"])

	def _insert_email_account(self, name, email_id, enable_outgoing):
		frappe.get_doc(
			{
				"doctype": "Email Account",
				"name": name,
				"email_account_name": name,
				"email_id": email_id,
				"enable_outgoing": enable_outgoing,
			}
		).db_insert()

	def _insert_data_import(self, reference_doctype, status):
		frappe.get_doc(
			{
				"doctype": "Data Import",
				"name": frappe.generate_hash(length=10),
				"reference_doctype": reference_doctype,
				"import_type": "Insert New Records",
				"status": status,
			}
		).db_insert()

	# Guards: a Zoom account not ticking its step, or ticking the Meet one. Introduced in this branch
	# (feat/onboarding-flows, PR pending); test added there to keep the providers apart.
	def test_zoom_account(self):
		frappe.get_doc(
			{
				"doctype": "LMS Zoom Settings",
				"name": "Onboarding Zoom",
				"account_name": "Onboarding Zoom",
				"account_id": "acc",
				"client_id": "cid",
				"member": self.admin.name,
			}
		).db_insert()
		facts = self._facts()
		self.assertTrue(facts["has_zoom_account"])
		self.assertFalse(facts["has_meet_account"])

	# Guards: a Meet account not ticking its step, or ticking the Zoom one. Introduced in this branch
	# (feat/onboarding-flows, PR pending); test added there to keep the providers apart.
	def test_meet_account(self):
		frappe.get_doc(
			{
				"doctype": "LMS Google Meet Settings",
				"name": "Onboarding Meet",
				"account_name": "Onboarding Meet",
				"member": self.admin.name,
			}
		).db_insert()
		facts = self._facts()
		self.assertTrue(facts["has_meet_account"])
		self.assertFalse(facts["has_zoom_account"])

	# Guards: Google API ticking with Google Settings disabled or missing a credential. Introduced in this
	# branch (feat/onboarding-flows, PR pending); test added there to require all three.
	def test_google_api_needs_enable_id_and_secret(self):
		self._set_google_settings(enable=1, client_id="client", client_secret=None)
		self.assertFalse(self._facts()["has_google_api"])

		self._set_google_settings(enable=0, client_id="client", client_secret="secret")
		self.assertFalse(self._facts()["has_google_api"])

		self._set_google_settings(enable=1, client_id="client", client_secret="secret")
		self.assertTrue(self._facts()["has_google_api"])

	# Guards: a calendar that never finished OAuth ticking the calendar step. Introduced in this branch
	# (feat/onboarding-flows, PR pending); test added there to require a refresh token.
	def test_google_calendar_needs_a_refresh_token_for_this_user(self):
		calendar = self._insert_google_calendar("Administrator")
		self.assertFalse(self._facts()["has_google_calendar"])

		frappe.db.set_value("Google Calendar", calendar, "refresh_token", "token")
		self.assertTrue(self._facts()["has_google_calendar"])

	# Guards: another user's authorised calendar ticking the admin's calendar step. Introduced in this
	# branch (feat/onboarding-flows, PR pending); test added there to scope it to the session user.
	def test_another_users_calendar_does_not_count(self):
		calendar = self._insert_google_calendar(self.admin.name)
		frappe.db.set_value("Google Calendar", calendar, "refresh_token", "token")
		self.assertFalse(self._facts()["has_google_calendar"])

	def _set_google_settings(self, enable, client_id, client_secret):
		settings = frappe.get_single("Google Settings")
		settings.enable = enable
		settings.client_id = client_id
		settings.client_secret = client_secret
		settings.flags.ignore_mandatory = True
		settings.save()

	def _insert_google_calendar(self, user):
		name = frappe.generate_hash(length=10)
		frappe.get_doc(
			{
				"doctype": "Google Calendar",
				"name": name,
				"calendar_name": name,
				"user": user,
				"enable": 1,
			}
		).db_insert()
		return name

	def _insert_live_class(self, batch):
		frappe.get_doc(
			{
				"doctype": "LMS Live Class",
				"name": frappe.generate_hash(length=10),
				"title": "Onboarding live class",
				"batch_name": batch,
				"host": self.admin.name,
				"date": nowdate(),
				"time": "10:00:00",
				"duration": 60,
				"timezone": "Asia/Kolkata",
			}
		).db_insert()

	def _insert_quiz(self, title):
		quiz = frappe.get_doc(
			{
				"doctype": "LMS Quiz",
				"name": frappe.generate_hash(length=10),
				"title": title,
				"passing_percentage": 50,
				"total_marks": 1,
			}
		)
		quiz.db_insert()
		return quiz

	def _set_creation(self, course, creation):
		frappe.db.set_value("LMS Course", course, "creation", creation, update_modified=False)
