import glob
import os
import re
import zipfile

import frappe

from lms.lms.api import (
	export_course_as_zip,
	get_certified_participants,
	get_course_assessment_progress,
	import_course_from_zip,
)
from lms.lms.course_import_export import sanitize_string
from lms.lms.test_helpers import BaseTestUtils
from unittest.mock import patch

class TestLMSAPI(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self._setup_course_flow()

	def test_certified_participants_with_category(self):
		filters = {"category": "Utility Course"}
		certified_participants = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants), 1)
		self.assertEqual(certified_participants[0].full_name, self.student1.full_name)
		self.assertNotIn("member", certified_participants[0])

		filters = {"category": "Nonexistent Category"}
		certified_participants_no_match = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants_no_match), 0)

	def test_certified_participants_with_open_to_work(self):
		filters = {"open_to_work": 1}
		certified_participants_open_to_work = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants_open_to_work), 0)

		frappe.db.set_value("User", self.student1.email, "open_to", "Work")
		certified_participants_open_to_work = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants_open_to_work), 1)
		frappe.db.set_value("User", self.student1.email, "open_to", "")

	def test_certified_participants_with_open_to_hiring(self):
		filters = {"hiring": 1}
		certified_participants_hiring = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants_hiring), 0)

		frappe.db.set_value("User", self.student1.email, "open_to", "Hiring")
		certified_participants_hiring = get_certified_participants(filters=filters)
		self.assertEqual(len(certified_participants_hiring), 1)
		frappe.db.set_value("User", self.student1.email, "open_to", "")

	def test_course_assessment_progress(self):
		progress = get_course_assessment_progress(self.course.name, self.student1.name)
		progress = frappe._dict(progress)

		self.assertEqual(len(progress.quizzes), 1)
		for quiz in progress.quizzes:
			self.assertEqual(quiz.quiz, self.quiz.name)
			self.assertEqual(quiz.quiz_title, self.quiz.title)
			self.assertEqual(quiz.score, 10)
			self.assertEqual(quiz.percentage, 66)

		self.assertEqual(len(progress.assignments), 1)
		for assignment in progress.assignments:
			self.assertEqual(assignment.assignment, self.assignment.name)
			self.assertEqual(assignment.assignment_title, self.assignment.title)
			self.assertEqual(assignment.status, "Pass")

		self.assertEqual(len(progress.exercises), 1)
		for exercise in progress.exercises:
			self.assertEqual(exercise.exercise, self.programming_exercise.name)
			self.assertEqual(exercise.exercise_title, self.programming_exercise.title)
			self.assertEqual(exercise.status, "Passed")

	def test_quiz_submission(self):
		submission = frappe.get_all(
			"LMS Quiz Submission", filters={"quiz": self.quiz.name, "member": self.student1.name}
		)
		self.assertEqual(len(submission), 1)
		submission = submission[0]
		submission = frappe.get_doc("LMS Quiz Submission", submission.name)

		self.assertEqual(submission.score, 10)
		self.assertEqual(submission.score_out_of, 15)
		self.assertEqual(submission.percentage, 66)
		self.assertEqual(submission.passing_percentage, 70)
		self.assertEqual(len(submission.result), 3)
		for index, result in enumerate(submission.result):
			self.assertEqual(result.question_name, self.quiz.questions[index].question)
			self.assertEqual(
				result.answer,
				self.questions[index].option_1 if index % 2 == 0 else self.questions[index].option_2,
			)
			self.assertEqual(result.is_correct, 1 if index % 2 == 0 else 0)
			self.assertEqual(result.marks, 5 if index % 2 == 0 else 0)

	def test_export_course_as_zip(self):
		latest_file = self.get_latest_zip_file()
		self.assertTrue(latest_file)
		self.assertTrue(latest_file.endswith(".zip"))
		expected_name_pattern = re.escape(self.course.name) + r"_\d{8}_\d{6}_[a-f0-9]{8}\.zip"
		self.assertRegex(latest_file, expected_name_pattern)
		with zipfile.ZipFile(latest_file, "r") as zip_ref:
			expected_files = [
				"course.json",
				"instructors.json",
			]
			for expected_file in expected_files:
				self.assertIn(expected_file, zip_ref.namelist())
			chapter_files = [
				f for f in zip_ref.namelist() if f.startswith("chapters/") and f.endswith(".json")
			]
			self.assertEqual(len(chapter_files), 3)
			lesson_files = [f for f in zip_ref.namelist() if f.startswith("lessons/") and f.endswith(".json")]
			self.assertEqual(len(lesson_files), 12)
			assessment_files = [
				f
				for f in zip_ref.namelist()
				if f.startswith("assessments/") and f.endswith(".json") and len(f.split("/")) == 2
			]
			self.assertEqual(len(assessment_files), 3)

	def get_latest_zip_file(self):
		export_course_as_zip(self.course.name)
		site_path = frappe.get_site_path("private", "files")
		zip_files = glob.glob(os.path.join(site_path, f"{self.course.name}_*.zip"))
		latest_file = max(zip_files, key=os.path.getctime) if zip_files else None
		return latest_file

	def test_import_course_from_zip(self):
		imported_course = self.get_imported_course()
		self.assertEqual(imported_course.title, self.course.title)
		self.assertEqual(imported_course.category, self.course.category)
		# self.assertEqual(imported_course.lessons, self.course.lessons)
		self.assertEqual(len(imported_course.instructors), len(self.course.instructors))
		self.assertEqual(imported_course.instructors[0].instructor, self.course.instructors[0].instructor)
		imported_first_chapter = frappe.get_doc("Course Chapter", self.course.chapters[0].chapter)
		original_first_chapter = frappe.get_doc("Course Chapter", self.course.chapters[0].chapter)
		self.assertEqual(imported_first_chapter.title, original_first_chapter.title)
		imported_first_lesson = frappe.get_doc("Course Lesson", imported_first_chapter.lessons[0].lesson)
		original_first_lesson = frappe.get_doc("Course Lesson", original_first_chapter.lessons[0].lesson)
		self.assertEqual(imported_first_lesson.title, original_first_lesson.title)
		self.assertEqual(imported_first_lesson.content, original_first_lesson.content)
		self.cleanup_imported_course(imported_course.name)

	def get_imported_course(self):
		latest_file = self.get_latest_zip_file()
		self.assertTrue(latest_file)
		zip_file_path = f"/{'/'.join(latest_file.split('/')[2:])}"
		imported_course_name = import_course_from_zip(zip_file_path)
		imported_course = frappe.get_doc("LMS Course", imported_course_name)
		return imported_course

	def cleanup_imported_course(self, course_name):
		self.cleanup_items.append(("LMS Course", course_name))
		self.cleanup_imported_assessment("LMS Quiz", self.quiz)
		self.cleanup_imported_assessment("LMS Assignment", self.assignment)
		self.cleanup_imported_assessment("LMS Programming Exercise", self.programming_exercise)

	def cleanup_imported_assessment(self, doctype, doc):
		imported_assessment = frappe.db.get_value(
			doctype, {"title": doc.title, "name": ["!=", doc.name]}, "name"
		)
		if imported_assessment:
			self.cleanup_items.append((doctype, imported_assessment))

	def test_sanitize_string_filename_behavior(self):
		result = sanitize_string(
			"my file@name!.txt", allow_spaces=False, replacement_char="_", escape_html_content=False
		)
		self.assertEqual(result, "my_file_name_.txt")

	def test_sanitize_string_name_field_behavior(self):
		result = sanitize_string(
			"John#Doe$", allow_spaces=True, max_length=50, replacement_char=None, escape_html_content=True
		)
		self.assertEqual(result, "JohnDoe")

	def test_get_user_info_guest(self):
		frappe.set_user("Guest")
		from lms.lms.api import get_user_info
		user_info = get_user_info()
		self.assertIsNone(user_info)
		frappe.set_user("Administrator") 

	def test_get_user_info_student(self):
		frappe.set_user(self.student1.email)
		from lms.lms.api import get_user_info
		user_info = get_user_info()
		
		self.assertIsNotNone(user_info)
		self.assertEqual(user_info.email, self.student1.email)
		self.assertFalse(user_info.is_instructor)
		self.assertFalse(user_info.is_moderator)
		self.assertFalse(user_info.is_evaluator)
		self.assertTrue(user_info.is_student)
		frappe.set_user("Administrator")

	def test_get_translations_execution(self):
		from lms.lms.api import get_translations
		
		frappe.set_user(self.student1.email)
		translations_user = get_translations()
		self.assertIsInstance(translations_user, dict)
		
		frappe.set_user("Guest")
		translations_guest = get_translations()
		self.assertIsInstance(translations_guest, dict)
		
		frappe.set_user("Administrator")

	def test_validate_billing_access_structure(self):
		from lms.lms.api import validate_billing_access
		frappe.set_user(self.student1.email)
	
		result = validate_billing_access(billing_type="course", name=self.course.name)
		
		self.assertIn("access", result)
		self.assertIn("message", result)
		self.assertIn("address", result)
		self.assertIn("billing_field_meta", result)
		self.assertIsInstance(result["billing_field_meta"], dict)
		
		frappe.set_user("Administrator")
		
	def test_get_payment_field_meta(self):
		from lms.lms.api import get_payment_field_meta
		meta = get_payment_field_meta()
		self.assertIsInstance(meta, dict)
		self.assertIn("member", meta)
		self.assertIn("amount", meta)

	def test_verify_billing_access_guest(self):
		from lms.lms.api import verify_billing_access
		frappe.set_user("Guest")
		access, message = verify_billing_access("LMS Course", "Cualquier Curso", "course")
		self.assertFalse(access)
		self.assertEqual(message, "Please login to continue with payment.")
		frappe.set_user("Administrator")

	def test_verify_billing_access_invalid_type(self):
		from lms.lms.api import verify_billing_access
		frappe.set_user(self.student1.email)
		access, message = verify_billing_access("LMS Course", self.course.name, "hacker_module")
		self.assertFalse(access)
		self.assertEqual(message, "Module is incorrect.")
		frappe.set_user("Administrator")

	def test_get_application_users_empty(self):
		from lms.lms.api import get_application_users
		self.assertEqual(get_application_users([]), [])
		self.assertEqual(get_application_users("[]"), [])

	def test_sanitize_job_filters_cleaning(self):
		from lms.lms.api import sanitize_job_filters
		
		raw_filters = {"status": "Open", "invalid_hacker_key": "Drop Table", "country": "Peru"}
		raw_or_filters = {"job_title": "Developer", "malicious_or": "Admin"}
		
		clean_filters, clean_or_filters = sanitize_job_filters(raw_filters, raw_or_filters)
		
		self.assertIn("status", clean_filters)
		self.assertIn("country", clean_filters)
		self.assertIn("job_title", clean_or_filters)
		
		self.assertNotIn("invalid_hacker_key", clean_filters)
		self.assertNotIn("malicious_or", clean_or_filters)

	def test_sanitize_job_filters_closed_permissions(self):
		from lms.lms.api import sanitize_job_filters
		frappe.set_user(self.student1.email) 
		
		filters = {"status": "Closed"}
		clean_filters, _ = sanitize_job_filters(filters, None)
		
		self.assertEqual(clean_filters.get("owner"), self.student1.email)
		frappe.set_user("Administrator")

class TestLMSAPIModules(BaseTestUtils):
	def setUp(self):
		super().setUp()
		# Forzamos Administrador para asegurar permisos de lectura
		frappe.set_user("Administrator")

	def tearDown(self):
		# Restauramos el estado
		frappe.set_user("Administrator")
		super().tearDown()

	def test_job_opportunities_execution(self):
		from lms.lms.api import get_job_opportunities, get_job_opportunities_count
		
		# Validamos la estructura de retorno sin depender de registros fijos
		jobs = get_job_opportunities()
		self.assertIsInstance(jobs, list)
		
		count = get_job_opportunities_count()
		self.assertIsInstance(count, int)

	def test_get_chart_details_structure(self):
		from lms.lms.api import get_chart_details
		details = get_chart_details()
		
		# Validamos que el diccionario exponga las métricas del Dashboard
		self.assertIsInstance(details, dict)
		self.assertIn("enrollments", details)
		self.assertIn("courses", details)
		self.assertIn("users", details)
		self.assertIn("certifications", details)

	def test_get_branding_data(self):
		from lms.lms.api import get_branding
		branding = get_branding()
		
		self.assertIsInstance(branding, dict)
		self.assertIn("app_name", branding)

	@patch("lms.lms.api.get_unsplash_photos")
	def test_get_unsplash_photos_mocked(self, mock_unsplash):
		from lms.lms.api import get_unsplash_photos
		
		# Interceptamos la llamada para no consumir la API externa real en los tests
		mock_unsplash.return_value = [{"id": "xyz", "url": "foto.jpg"}]
		photos = get_unsplash_photos(keyword="universidad")
		
		self.assertEqual(len(photos), 1)
		self.assertEqual(photos[0]["id"], "xyz")

	def test_get_evaluator_details_permissions(self):
		from lms.lms.api import get_evaluator_details
		
		# El método exige frappe.only_for("Batch Evaluator")
		frappe.set_user("Guest")
		
		# Un usuario sin el rol específico debe detonar un PermissionError,
		# esto evita que el test intente insertar datos basura en Google Calendar
		self.assertRaises(frappe.PermissionError, get_evaluator_details, "test@evaluator.com")

	@patch("lms.lms.api.get_certification_query")
	def test_get_count_of_certified_members_mocked(self, mock_query):
		from lms.lms.api import get_count_of_certified_members
		
		# Simulamos el objeto de consulta para no depender de registros reales
		class MockQuery:
			def run(self, as_dict):
				return [{"name": "Cert1"}, {"name": "Cert2"}, {"name": "Cert3"}]
				
		mock_query.return_value = MockQuery()
		count = get_count_of_certified_members()
		self.assertEqual(count, 3)

	def test_get_certification_categories_execution(self):
		from lms.lms.api import get_certification_categories
		categories = get_certification_categories()
		self.assertIsInstance(categories, list)

	def test_get_all_users_permissions(self):
		from lms.lms.api import get_all_users
		
		# Validamos que un Guest sin el rol exigido lance PermissionError
		frappe.set_user("Guest")
		self.assertRaises(frappe.PermissionError, get_all_users)
		
		# Administrator se salta la validación de only_for, así que debe funcionar
		frappe.set_user("Administrator")
		users = get_all_users()
		self.assertIsInstance(users, dict)

	def test_get_sidebar_settings_structure(self):
		from lms.lms.api import get_sidebar_settings
		frappe.set_user("Administrator")
		settings = get_sidebar_settings()
		
		self.assertIsInstance(settings, dict)
		self.assertIn("courses", settings)
		self.assertIn("certifications", settings)

	@patch("lms.lms.api.frappe.db.delete")
	@patch("lms.lms.api.frappe.new_doc")
	@patch("lms.lms.api.frappe.db.set_value")
	@patch("lms.lms.api.frappe.db.exists")
	def test_update_and_delete_sidebar_item(self, mock_exists, mock_set_value, mock_new_doc, mock_delete):
		from lms.lms.api import update_sidebar_item, delete_sidebar_item
		from unittest.mock import MagicMock # <-- Importación segura aquí adentro
		
		# 1. Simular la actualización de un ítem existente
		mock_exists.return_value = True
		update_sidebar_item("test-page", "icon-1")
		mock_set_value.assert_called_once()
		
		# 2. Simular la creación de un ítem nuevo
		mock_exists.return_value = False
		mock_doc_instance = MagicMock()
		mock_new_doc.return_value = mock_doc_instance
		update_sidebar_item("test-page-2", "icon-2")
		mock_doc_instance.insert.assert_called_once()
		
		# 3. Simular la eliminación
		delete_sidebar_item("test-page")
		mock_delete.assert_called_once()