# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import importlib
import pkgutil
from unittest.mock import patch

import frappe
from frappe.handler import execute_cmd, is_valid_http_method
from frappe.utils import set_request

from lms.lms.test_helpers import BaseTestUtils

# GET skips the CSRF check and rolls back only the database, so a mutating endpoint
# that accepts it runs from a cross-site link. Every whitelisted lms method must
# accept POST only, unless it is listed here as one that only reads.
READ_ONLY_ENDPOINTS = (
	"lms.command_palette.search_sqlite",
	# Scores outputs, stores nothing.
	"lms.lms.api.evaluate_programming_exercise",
	"lms.lms.api.get_admin_evals",
	"lms.lms.api.get_admin_live_classes",
	"lms.lms.api.get_all_users",
	"lms.lms.api.get_announcements",
	"lms.lms.api.get_application_users",
	"lms.lms.api.get_badges",
	"lms.lms.api.get_branding",
	"lms.lms.api.get_bulk_enrollment_preview",
	"lms.lms.api.get_certification_categories",
	"lms.lms.api.get_certification_details",
	"lms.lms.api.get_certified_participants",
	"lms.lms.api.get_chart_details",
	"lms.lms.api.get_count_of_certified_members",
	"lms.lms.api.get_course_assessment_progress",
	"lms.lms.api.get_course_progress_distribution",
	"lms.lms.api.get_course_to_continue",
	"lms.lms.api.get_created_batches",
	"lms.lms.api.get_created_courses",
	"lms.lms.api.get_doc_permissions_many",
	"lms.lms.api.get_evaluator_details",
	"lms.lms.api.get_heatmap_data",
	"lms.lms.api.get_job_details",
	"lms.lms.api.get_job_opportunities",
	"lms.lms.api.get_job_opportunities_count",
	"lms.lms.api.get_lesson_completion_stats",
	"lms.lms.api.get_live_class_start_url",
	"lms.lms.api.get_lms_settings",
	"lms.lms.api.get_member",
	"lms.lms.api.get_members",
	"lms.lms.api.get_meta_info",
	"lms.lms.api.get_my_batches",
	"lms.lms.api.get_my_courses",
	"lms.lms.api.get_my_live_classes",
	"lms.lms.api.get_new_gateway_fields",
	"lms.lms.api.get_notifications",
	"lms.lms.api.get_own_assignment_submission",
	"lms.lms.api.get_payment_field_meta",
	"lms.lms.api.get_payment_gateway_details",
	"lms.lms.api.get_profile_details",
	"lms.lms.api.get_programming_exercise",
	"lms.lms.api.get_pwa_manifest",
	"lms.lms.api.get_sidebar_settings",
	"lms.lms.api.get_streak_info",
	"lms.lms.api.get_system_preferences",
	"lms.lms.api.get_translations",
	"lms.lms.api.get_unsplash_photos",
	"lms.lms.api.get_user_certificates",
	"lms.lms.api.get_user_info",
	"lms.lms.api.search_currencies",
	"lms.lms.api.search_users_by_role",
	"lms.lms.api.search_users_to_enroll",
	# Redirects to the stored start link.
	"lms.lms.api.start_live_class",
	"lms.lms.api.validate_billing_access",
	"lms.lms.doctype.course_chapter.course_chapter.get_scorm_playback",
	"lms.lms.doctype.course_evaluator.course_evaluator.get_schedule",
	"lms.lms.doctype.course_lesson.course_lesson.serve_resource",
	"lms.lms.doctype.lms_batch.lms_batch.get_batch_timetable",
	# Maps an unsaved doc for the form; the save is a separate call.
	"lms.lms.doctype.lms_certificate_evaluation.lms_certificate_evaluation.create_lms_certificate",
	# Maps an unsaved doc for the form; the save is a separate call.
	"lms.lms.doctype.lms_certificate_request.lms_certificate_request.create_lms_certificate_evaluation",
	"lms.lms.doctype.lms_question.lms_question.serve_question_resource",
	# Grades one answer, stores nothing.
	"lms.lms.doctype.lms_quiz.lms_quiz.check_answer",
	"lms.lms.doctype.lms_quiz.lms_quiz.get_question_bank",
	"lms.lms.doctype.lms_quiz.lms_quiz.get_question_meta",
	"lms.lms.doctype.lms_quiz.lms_quiz.get_quiz_violation_logs",
	"lms.lms.doctype.lms_quiz.lms_quiz.is_open_ended_submission",
	"lms.lms.email_account.get_email_account",
	"lms.lms.email_account.get_email_accounts",
	"lms.lms.onboarding.get_first_batch",
	"lms.lms.onboarding.get_first_course",
	"lms.lms.utils.get_assessments",
	"lms.lms.utils.get_assignment",
	"lms.lms.utils.get_batch_chart_data",
	"lms.lms.utils.get_batch_count",
	"lms.lms.utils.get_batch_courses",
	"lms.lms.utils.get_batch_details",
	"lms.lms.utils.get_batch_student_progress",
	"lms.lms.utils.get_batches",
	"lms.lms.utils.get_chart_data",
	"lms.lms.utils.get_course_categories",
	"lms.lms.utils.get_course_completion_data",
	"lms.lms.utils.get_course_count",
	"lms.lms.utils.get_course_details",
	"lms.lms.utils.get_course_outline",
	"lms.lms.utils.get_courses",
	"lms.lms.utils.get_discussion_replies",
	"lms.lms.utils.get_lesson",
	"lms.lms.utils.get_lesson_creation_details",
	"lms.lms.utils.get_order_summary",
	"lms.lms.utils.get_program_details",
	"lms.lms.utils.get_programs",
	"lms.lms.utils.get_quiz_with_questions",
	"lms.lms.utils.get_related_courses",
	"lms.lms.utils.get_reviews",
	"lms.lms.utils.get_roles",
	"lms.raven_provider.get_raven_setup",
)

# Writes on GET because something outside LMS makes the request.
GET_WRITERS = (
	# Google's OAuth redirect lands here as a GET; the pending sign-in state guards it.
	"lms.lms.api.google_calendar_callback",
)

# Spot checks that the derived set really holds the mutating endpoints.
KNOWN_MUTATING = (
	"lms.lms.api.delete_chapter",
	"lms.lms.doctype.lms_batch.lms_batch.create_live_class",
	"lms.lms.doctype.lms_quiz.lms_quiz.submit_quiz",
	"lms.lms.user.sign_up",
)

# A read-only endpoint, so a check that refused GET for everything would go red here.
READ_ONLY_CONTROL = "lms.lms.api.get_lms_settings"


def lms_whitelisted_methods() -> dict:
	"""Dotted path -> function for every whitelisted lms method. frappe.whitelisted
	fills as modules import, so import them all first."""
	import lms

	for module in pkgutil.walk_packages(lms.__path__, "lms."):
		leaf = module.name.rsplit(".", 1)[-1]
		if leaf.startswith("test_") or ".tests" in module.name or ".patches" in module.name:
			continue
		importlib.import_module(module.name)

	return {
		f"{fn.__module__}.{fn.__qualname__}": fn
		for fn in frappe.whitelisted
		if getattr(fn, "__module__", "").startswith("lms.")
	}


def accepts_only_post(fn) -> bool:
	return tuple(frappe.allowed_http_methods_for_whitelisted_func.get(fn, ())) == ("POST",)


class HttpMethodTestCase(BaseTestUtils):
	def _as_request(self, method, form_dict=None):
		previous_request = getattr(frappe.local, "request", None)
		previous_form_dict = frappe.local.form_dict
		set_request(method=method, path="/api/method/lms")
		frappe.local.form_dict = frappe._dict(form_dict or {})
		self.addCleanup(setattr, frappe.local, "form_dict", previous_form_dict)
		self.addCleanup(setattr, frappe.local, "request", previous_request)


class TestMutatingEndpointsArePostOnly(HttpMethodTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.endpoints = lms_whitelisted_methods()
		cls.mutating = {
			path: fn
			for path, fn in cls.endpoints.items()
			if path not in READ_ONLY_ENDPOINTS and path not in GET_WRITERS
		}

	def test_every_whitelisted_method_is_post_only_or_listed_as_a_reader(self):
		"""Mutating endpoints accepted GET, e.g. delete_chapter since #1132, and a hand-kept
		list of them missed new ones. Added for audit findings #27/#28."""
		for path, fn in self.mutating.items():
			with self.subTest(endpoint=path):
				self.assertTrue(
					accepts_only_post(fn),
					f"{path} accepts GET; add methods=['POST'] or, if it only reads, list it in READ_ONLY_ENDPOINTS",
				)

	def test_the_allowlists_name_live_get_endpoints(self):
		"""A stale or POST-only entry would hide the next endpoint added under that name."""
		for path in READ_ONLY_ENDPOINTS + GET_WRITERS:
			with self.subTest(endpoint=path):
				self.assertIn(path, self.endpoints)
				self.assertFalse(accepts_only_post(self.endpoints[path]))

	def test_the_derived_set_holds_the_known_mutating_endpoints(self):
		"""Sanity: an import walk that found nothing would pass the check above vacuously."""
		for path in KNOWN_MUTATING:
			with self.subTest(endpoint=path):
				self.assertIn(path, self.mutating)

	def test_get_is_refused_for_every_mutating_endpoint(self):
		self._as_request("GET")
		for path, fn in self.mutating.items():
			with self.subTest(endpoint=path):
				with self.assertRaises(frappe.PermissionError):
					is_valid_http_method(fn)

	def test_post_is_allowed_for_every_mutating_endpoint(self):
		"""Control: POST still passes, so the GET refusal is not blanket."""
		self._as_request("POST")
		for path, fn in self.mutating.items():
			with self.subTest(endpoint=path):
				is_valid_http_method(fn)

	def test_read_only_control_still_answers_get(self):
		"""Control: a read endpoint still answers GET."""
		self._as_request("GET")
		is_valid_http_method(frappe.get_attr(READ_ONLY_CONTROL))


class TestCrossSiteGetChangesNothing(HttpMethodTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.instructor = cls._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Course Creator", "Moderator"]
		)

	def _chapter_on_course(self):
		course = self._create_course()
		chapter = self._create_chapter(f"Chapter {frappe.generate_hash(length=6)}", course.name)
		self._create_chapter_reference(course.name, chapter.name)
		return chapter

	def test_author_get_to_delete_chapter_leaves_the_chapter(self):
		"""delete_chapter accepted GET since #1132.
		Added for audit finding #27."""
		chapter = self._chapter_on_course()
		frappe.set_user(self.instructor.name)
		self._as_request("GET", {"chapter": chapter.name})

		with self.assertRaises(frappe.PermissionError):
			execute_cmd("lms.lms.api.delete_chapter")

		self.assertTrue(frappe.db.exists("Course Chapter", chapter.name))

	def test_author_post_to_delete_chapter_deletes_it(self):
		"""Control for the GET test above."""
		chapter = self._chapter_on_course()
		frappe.set_user(self.instructor.name)
		self._as_request("POST", {"chapter": chapter.name})

		execute_cmd("lms.lms.api.delete_chapter")

		self.assertFalse(frappe.db.exists("Course Chapter", chapter.name))

	def test_get_to_create_live_class_never_reaches_the_body(self):
		"""create_live_class accepted GET since #487.
		Added for audit finding #28."""
		self._as_request("GET", self._live_class_args())

		with (
			patch(
				"lms.lms.doctype.lms_batch.lms_batch.check_can_schedule_live_class",
				side_effect=frappe.PermissionError,
			) as gate,
			self.assertRaises(frappe.PermissionError),
		):
			execute_cmd("lms.lms.doctype.lms_batch.lms_batch.create_live_class")

		gate.assert_not_called()

	def test_post_to_create_live_class_reaches_the_body(self):
		"""Control for the GET test above."""
		self._as_request("POST", self._live_class_args())

		with (
			patch(
				"lms.lms.doctype.lms_batch.lms_batch.check_can_schedule_live_class",
				side_effect=frappe.PermissionError,
			) as gate,
			self.assertRaises(frappe.PermissionError),
		):
			execute_cmd("lms.lms.doctype.lms_batch.lms_batch.create_live_class")

		gate.assert_called_once()

	def _live_class_args(self):
		return {
			"batch_name": "any-batch",
			"zoom_account": "any-account",
			"title": "Injected",
			"duration": 30,
			"date": "2026-10-02",
			"time": "10:00",
			"timezone": "Asia/Kolkata",
			"auto_recording": "No Recording",
		}
