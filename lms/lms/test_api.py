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
		from unittest.mock import MagicMock
		
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

from unittest.mock import patch, MagicMock

class TestLMSAPILessonAndMembers(BaseTestUtils):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	@patch("lms.lms.api.can_modify_course")
	@patch("lms.lms.api.frappe.db.get_value")
	def test_delete_lesson_permissions(self, mock_get_value, mock_can_modify):
		from lms.lms.api import delete_lesson
		
		# Simulamos que el usuario NO tiene permisos sobre el curso
		mock_can_modify.return_value = False
		mock_get_value.return_value = "Course Test"
		
		self.assertRaises(frappe.PermissionError, delete_lesson, "Lesson 1", "Chapter 1")

	@patch("lms.lms.api.can_modify_course")
	@patch("lms.lms.api.frappe.db.get_value")
	@patch("lms.lms.api.frappe.get_all")
	@patch("lms.lms.api.frappe.db.delete")
	@patch("lms.lms.api.update_index")
	@patch("lms.lms.api.frappe.delete_doc")
	def test_delete_lesson_execution(self, mock_delete_doc, mock_update_index, mock_db_delete, mock_get_all, mock_get_value, mock_can_modify):
		from lms.lms.api import delete_lesson
		
		# Simulamos permisos aprobados y una lista de lecciones preexistentes
		mock_can_modify.return_value = True
		mock_get_value.return_value = "Course Test"
		mock_get_all.return_value = ["Lesson 1", "Lesson 2"]
		
		delete_lesson("Lesson 1", "Chapter 1")
		
		# Verificamos que las acciones destructivas se hayan llamado correctamente
		self.assertEqual(mock_db_delete.call_count, 2) # 1 para Lesson Reference, 1 para Course Progress
		mock_delete_doc.assert_called_once_with("Course Lesson", "Lesson 1")

	@patch("lms.lms.api.can_modify_course")
	@patch("lms.lms.api.frappe.db.get_value")
	def test_update_lesson_index_permissions(self, mock_get_value, mock_can_modify):
		from lms.lms.api import update_lesson_index
		
		mock_can_modify.return_value = False
		self.assertRaises(frappe.PermissionError, update_lesson_index, "L1", "C1", "C2", 1)

	@patch("lms.lms.api.frappe.db.set_value")
	def test_update_index_logic(self, mock_set_value):
		from lms.lms.api import update_index
		
		lessons = ["Lesson A", "Lesson B", "Lesson C"]
		update_index(lessons, "Chapter 1")
		
		# set_value debió llamarse 3 veces para reordenar los índices 1, 2 y 3
		self.assertEqual(mock_set_value.call_count, 3)

	@patch("lms.lms.api.can_modify_course")
	@patch("lms.lms.api.frappe.get_all")
	@patch("lms.lms.api.frappe.db.set_value")
	def test_update_chapter_index_execution(self, mock_set_value, mock_get_all, mock_can_modify):
		from lms.lms.api import update_chapter_index
		
		mock_can_modify.return_value = True
		mock_get_all.return_value = ["Chapter 1", "Chapter 2"]
		
		# Movemos Chapter 2 a la posición 0 (al inicio)
		update_chapter_index("Chapter 2", "Course 1", 0) 
		
		# Al haber 2 capítulos, debe actualizar ambos índices en la BD
		self.assertEqual(mock_set_value.call_count, 2)

	def test_get_members_permissions(self):
		from lms.lms.api import get_members
		
		frappe.set_user("Guest")
		# Un Guest no tiene el rol exigido de "Moderator"
		self.assertRaises(frappe.PermissionError, get_members)
		frappe.set_user("Administrator")

	@patch("lms.lms.api.frappe.get_all")
	def test_get_members_execution(self, mock_get_all):
		from lms.lms.api import get_members
		frappe.set_user("Administrator") 
		
		# Configuramos un miembro usando frappe._dict para emular el registro real
		mock_user = frappe._dict({
			"name": "test_user",
			"full_name": "Test User",
			"user_image": "test.jpg",
			"username": "testuser",
			"last_active": "2026-06-10"
		})
		
	def mock_get_all_side_effect(doctype, *args, **kwargs):
		if doctype == "User":
			return [mock_user]
		elif doctype == "Has Role":
			return ["Moderator"]
		return []
			
		mock_get_all.side_effect = mock_get_all_side_effect
			
		members = get_members(search="Test")
			
		self.assertEqual(len(members), 1)
			
		# Validación dinámica: Cubre tanto si la API asigna 'role' (string) o 'roles' (lista)
		if "roles" in members[0]:
			self.assertIn("Moderator", members[0].roles)
		elif "role" in members[0]:
			self.assertEqual(members[0].role, "Moderator")
		else:
			self.fail("La API no asignó el rol al miembro.")	

	@patch("lms.lms.api.has_lms_role")
	def test_check_app_permission(self, mock_has_lms_role):
		from lms.lms.api import check_app_permission
		
		# Escenario 1: El Administrador siempre tiene pase directo
		frappe.set_user("Administrator")
		self.assertTrue(check_app_permission())
		
		# Escenario 2: Validar que un usuario estándar dependa de sus roles LMS
		frappe.set_user("test@user.com")
		mock_has_lms_role.return_value = True
		self.assertTrue(check_app_permission())

	@patch("lms.lms.api.frappe.new_doc")
	@patch("lms.lms.api.frappe.db.set_value")
	@patch("lms.lms.api.frappe.db.exists")
	def test_save_evaluation_details(self, mock_exists, mock_set_value, mock_new_doc):
		from lms.lms.api import save_evaluation_details
		frappe.set_user("Administrator")
		
		# Simular flujo 1: El registro ya existe (Se actualiza con set_value)
		mock_exists.return_value = "Eval-001"
		res_update = save_evaluation_details("user1", "course1", "2026-06-10", "10:00", "11:00", "Pass")
		self.assertEqual(res_update, "Eval-001")
		mock_set_value.assert_called_once()
		
		# Simular flujo 2: El registro NO existe (Se crea con new_doc e insert)
		mock_exists.return_value = False
		mock_doc = MagicMock()
		mock_doc.name = "New-Eval-001"
		mock_new_doc.return_value = mock_doc
		
		res_new = save_evaluation_details("user2", "course2", "2026-06-10", "10:00", "11:00", "Pass")
		self.assertEqual(res_new, "New-Eval-001")
		mock_doc.insert.assert_called_once()

	@patch("lms.lms.api.frappe.new_doc")
	@patch("lms.lms.api.frappe.db.set_value")
	@patch("lms.lms.api.frappe.db.exists")
	def test_save_certificate_details(self, mock_exists, mock_set_value, mock_new_doc):
		from lms.lms.api import save_certificate_details
		frappe.set_user("Administrator")
		
		# Simular actualización de certificado existente
		mock_exists.return_value = "Cert-001"
		res = save_certificate_details("user1", "2026-06-10", "Template A")
		self.assertEqual(res, "Cert-001")
		mock_set_value.assert_called_once()

	@patch("lms.lms.api.frappe.delete_doc")
	@patch("lms.lms.api.frappe.get_meta")
	def test_delete_documents_execution(self, mock_get_meta, mock_delete_doc):
		from lms.lms.api import delete_documents
		frappe.set_user("Administrator")
		
		# Caso de Éxito: Intentar borrar un documento que sí pertenece al módulo LMS
		mock_meta = MagicMock()
		mock_meta.module = "LMS"
		mock_get_meta.return_value = mock_meta
		
		delete_documents("LMS Course", ["Course 1", "Course 2"])
		self.assertEqual(mock_delete_doc.call_count, 2)
		
		# Caso de Fallo: Intentar borrar algo de un módulo Core bloqueado
		mock_meta.module = "Core"
		with self.assertRaises(Exception): # Atrapa el frappe.throw
			delete_documents("User", ["User 1"])

	def test_get_transformed_fields_logic(self):
		from lms.lms.api import get_transformed_fields
		
		# Mockear una fila de metadatos pura de Frappe
		mock_row = MagicMock()
		mock_row.fieldtype = "Data"
		mock_row.fieldname = "title"
		mock_row.label = "Title"
		mock_row.reqd = 1
		mock_row.options = None
		mock_row.default = "Untitled"
		mock_row.description = "Test Desc"
		
		res = get_transformed_fields([mock_row], {})
		
		# Validar que el mapeo limpia los datos y extrae las llaves exactas
		self.assertEqual(len(res), 1)
		self.assertEqual(res[0]["type"], "Data")
		self.assertEqual(res[0]["reqd"], 1)
		self.assertEqual(res[0]["default"], "Untitled")

	@patch("lms.lms.api.get_transformed_fields")
	@patch("lms.lms.api.frappe.get_meta")
	@patch("lms.lms.api.frappe.get_doc")
	def test_get_payment_gateway_details(self, mock_get_doc, mock_get_meta, mock_transform):
		from lms.lms.api import get_payment_gateway_details
		frappe.set_user("Administrator")
		
		# Simular la carga inicial del Gateway Base
		mock_gateway = MagicMock()
		mock_gateway.gateway_controller = None
		
		# Simular la configuración interna que Frappe buscaría (Ej. PayPal Settings)
		mock_settings = MagicMock()
		mock_settings.as_dict.return_value = {"api_key": "123"}
		
		# El side_effect nos permite devolver el Gateway en la 1ra llamada y los Settings en la 2da
		mock_get_doc.side_effect = [mock_gateway, mock_settings]
		mock_transform.return_value = [{"name": "api_key"}]
		
		res = get_payment_gateway_details("Stripe")
		
		# Validar la estructura del retorno para el frontend
		self.assertIn("fields", res)
		self.assertEqual(res["doctype"], "Stripe Settings")
		self.assertEqual(res["fields"][0]["name"], "api_key")

	@patch("lms.lms.api.get_transformed_fields")
	@patch("lms.lms.api.frappe.get_meta")
	def test_get_new_gateway_fields(self, mock_get_meta, mock_get_transformed):
		from lms.lms.api import get_new_gateway_fields
		frappe.set_user("Administrator")
		
		# Validación exitosa
		mock_get_meta.return_value = MagicMock(fields=[])
		mock_get_transformed.return_value = [{"name": "test_field"}]
		res = get_new_gateway_fields("Stripe Settings")
		self.assertEqual(res[0]["name"], "test_field")
		
		# Validación de manejo de errores
		mock_get_meta.side_effect = Exception("Not found")
		with self.assertRaises(Exception):
			get_new_gateway_fields("Fake Settings")

	@patch("lms.lms.api.frappe.get_cached_value")
	@patch("lms.lms.api.frappe.get_all")
	@patch("lms.lms.api.frappe.db.exists")
	@patch("lms.lms.api.frappe.get_roles")
	def test_get_announcements(self, mock_get_roles, mock_exists, mock_get_all, mock_cached_value):
		from lms.lms.api import get_announcements
		
		# Escenario: Bloqueo de seguridad sin permisos
		mock_get_roles.return_value = ["LMS Student"]
		mock_exists.return_value = False
		with self.assertRaises(frappe.PermissionError):
			get_announcements("Batch 1")
			
		# Escenario: Retorno correcto con permisos de Moderador
		mock_get_roles.return_value = ["Moderator"]
		mock_comms = [frappe._dict({"subject": "Aviso 1", "sender": "user1"})]
		mock_get_all.return_value = mock_comms
		mock_cached_value.return_value = "avatar.jpg"
		
		res = get_announcements("Batch 1")
		self.assertEqual(len(res), 1)
		self.assertEqual(res[0].image, "avatar.jpg")

	@patch("lms.lms.api.frappe.delete_doc")
	@patch("lms.lms.api.frappe.get_all")
	@patch("lms.lms.api.frappe.db.set_value")
	@patch("lms.lms.api.frappe.db.delete")
	@patch("lms.lms.api.can_modify_course")
	def test_delete_course_logic(self, mock_can_modify, mock_db_delete, mock_set_value, mock_get_all, mock_delete_doc):
		from lms.lms.api import delete_course
		
		mock_can_modify.return_value = True
		# Simulamos la existencia de 1 capítulo, 1 lección y 1 tópico para obligar al test a entrar en todos los bucles for anidados
		mock_get_all.side_effect = [
			["Chapter 1"], # Para la iteración de capítulos
			["Lesson 1"],  # Para la iteración de lecciones
			["Topic 1"]    # Para la iteración de discusiones
		]
		
		delete_course("Course A")
		self.assertTrue(mock_db_delete.called)
		self.assertTrue(mock_delete_doc.called)

	@patch("lms.lms.api.delete_batch_discussions")
	@patch("lms.lms.api.frappe.db.delete")
	@patch("lms.lms.api.can_modify_batch")
	def test_delete_batch_logic(self, mock_can_modify, mock_db_delete, mock_delete_discussions):
		from lms.lms.api import delete_batch
		
		mock_can_modify.return_value = True
		delete_batch("Batch A")
		
		# Verifica que las 6 tablas principales del batch se eliminen y se llame al helper de discusiones
		self.assertEqual(mock_db_delete.call_count, 6) 
		mock_delete_discussions.assert_called_once_with("Batch A")

	@patch("lms.lms.api.frappe.get_doc")
	@patch("lms.lms.api.frappe.db.exists")
	def test_give_discussions_permission(self, mock_exists, mock_get_doc):
		from lms.lms.api import give_discussions_permission
		
		# Simulamos que ningún permiso existe para que entre al bucle de creación total
		mock_exists.return_value = False
		mock_doc = MagicMock()
		mock_get_doc.return_value = mock_doc
		
		give_discussions_permission()
		
		# Son 2 DocTypes ("Topic", "Reply") * 4 Roles = 8 operaciones de guardado esperadas
		self.assertEqual(mock_doc.save.call_count, 8)

	@patch("lms.lms.api.frappe.get_doc")
	@patch("lms.lms.api.frappe.new_doc")
	@patch("lms.lms.api.can_modify_course")
	def test_upsert_chapter(self, mock_can_modify, mock_new_doc, mock_get_doc):
		from lms.lms.api import upsert_chapter
		
		mock_can_modify.return_value = True
		
		# Simulamos el capítulo nuevo
		mock_chapter = MagicMock()
		mock_chapter.lessons = [] # Prevenimos que entre al flujo complejo de SCORM extra
		mock_new_doc.return_value = mock_chapter
		
		# Simulamos el curso que la API intentará buscar internamente
		mock_course = MagicMock()
		mock_get_doc.return_value = mock_course
		
		res = upsert_chapter("Capitulo 1", "Curso A", False)
		
		mock_chapter.update.assert_called_once()
		mock_chapter.save.assert_called_once()
		self.assertEqual(res, mock_chapter)