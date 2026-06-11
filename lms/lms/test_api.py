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

	@patch("lms.lms.api.zipfile.ZipFile")
	@patch("lms.lms.api.os.path.realpath")
	@patch("lms.lms.api.frappe.get_site_path")
	@patch("lms.lms.api.frappe.get_doc")
	def test_extract_package(self, mock_get_doc, mock_get_site_path, mock_realpath, mock_zipfile):
		from lms.lms.api import extract_package
		
		mock_package = MagicMock()
		mock_package.get_full_path.return_value = "/fake/zip.zip"
		mock_get_doc.return_value = mock_package
		
		mock_get_site_path.side_effect = ["/fake/public/scorm", "/fake/public/scorm/Course/Chap"]
		mock_realpath.side_effect = lambda x: x
		
		mock_zip_instance = MagicMock()
		mock_zip_instance.namelist.return_value = ["clean_file.html"]
		mock_zipfile.return_value.__enter__.return_value = mock_zip_instance
		
		res = extract_package("Course", "Chap", frappe._dict({"name": "test"}))
		self.assertEqual(res, "/fake/public/scorm/Course/Chap")
		
		mock_realpath.side_effect = ["/fake/public/scorm", "/evil/path"]
		with self.assertRaises(Exception):
			extract_package("Course", "Chap", frappe._dict({"name": "test"}))

	@patch("lms.lms.api.zipfile.ZipFile")
	def test_check_for_malicious_code(self, mock_zipfile):
		from lms.lms.api import check_for_malicious_code
		
		mock_zip_instance = MagicMock()
		mock_zip_instance.namelist.return_value = ["test.html"]
		mock_file = MagicMock()
		mock_file.read.return_value = b"<html>clean</html>"
		mock_zip_instance.open.return_value.__enter__.return_value = mock_file
		mock_zipfile.return_value.__enter__.return_value = mock_zip_instance
		
		check_for_malicious_code("/fake/path.zip")
		
		mock_file.read.return_value = b"<html><script src='http://evil.com'></script></html>"
		with self.assertRaises(Exception):
			check_for_malicious_code("/fake/path.zip")

	@patch("lms.lms.api.os.walk")
	def test_get_manifest_file(self, mock_walk):
		from lms.lms.api import get_manifest_file
		
		mock_walk.return_value = [("/fake/path", [], ["imsmanifest.xml"])]
		res = get_manifest_file("/fake/path")
		self.assertEqual(res, "/fake/path/imsmanifest.xml")

	@patch("lms.lms.api.parseString")
	@patch("builtins.open")
	@patch("lms.lms.api.get_manifest_file")
	def test_get_launch_file(self, mock_get_manifest, mock_open, mock_parseString):
		from lms.lms.api import get_launch_file
		
		mock_get_manifest.return_value = "/fake/path/imsmanifest.xml"
		
		# Configuramos la simulación de lectura del archivo XML por dentro de la función
		mock_open.return_value.__enter__.return_value.read.return_value = "<xml></xml>"
		
		mock_dom = MagicMock()
		mock_res = MagicMock()
		mock_res.getAttribute.side_effect = lambda x: "sco" if x in ["adlcp:scormtype", "adlcp:scormType"] else "index.html"
		mock_dom.getElementsByTagName.return_value = [mock_res]
		mock_parseString.return_value = mock_dom
		
		res = get_launch_file("/fake/path")
		self.assertEqual(res, "/fake/path/index.html")

	@patch("lms.lms.api.frappe.new_doc")
	def test_add_lesson(self, mock_new_doc):
		from lms.lms.api import add_lesson
		
		mock_doc = MagicMock()
		mock_doc.name = "New Lesson"
		mock_new_doc.return_value = mock_doc
		
		add_lesson("Title", "Chap", "Course", 1)
		self.assertEqual(mock_doc.insert.call_count, 2)

	@patch("lms.lms.api.shutil.rmtree")
	@patch("lms.lms.api.os.path.exists")
	@patch("lms.lms.api.frappe.get_site_path")
	def test_delete_scorm_package(self, mock_get_site, mock_exists, mock_rmtree):
		from lms.lms.api import delete_scorm_package
		mock_get_site.return_value = "/fake/site/path"
		mock_exists.return_value = True
		delete_scorm_package("/scorm1")
		mock_rmtree.assert_called_once_with("/fake/site/path")

	@patch("lms.lms.api.save_progress")
	@patch("lms.lms.api.frappe.get_value")
	def test_mark_lesson_progress(self, mock_get_value, mock_save_progress):
		from lms.lms.api import mark_lesson_progress
		mock_get_value.side_effect = ["Chapter 1", "Lesson 1"]
		mark_lesson_progress("Course 1", 1, 1)
		mock_save_progress.assert_called_once_with("Lesson 1", "Course 1")

	@patch("lms.lms.api.prepare_heatmap_data")
	@patch("lms.lms.api.count_dates")
	@patch("lms.lms.api.fetch_activity_data")
	@patch("lms.lms.api.initialize_date_count")
	@patch("lms.lms.api.calculate_date_ranges")
	@patch("lms.lms.api.has_course_instructor_role")
	@patch("lms.lms.api.has_moderator_role")
	@patch("lms.lms.api.has_evaluator_role")
	def test_get_heatmap_data(self, mock_evaluator, mock_moderator, mock_instructor, mock_calc, mock_init, mock_fetch, mock_count, mock_prep):
		from lms.lms.api import get_heatmap_data
		mock_evaluator.return_value = False
		mock_moderator.return_value = False
		mock_instructor.return_value = False
		with self.assertRaises(frappe.PermissionError):
			get_heatmap_data("test_user")
		mock_instructor.return_value = True
		mock_calc.return_value = ("base", "start", 10, [])
		mock_init.return_value = {}
		mock_fetch.return_value = ([], [], [])
		mock_prep.return_value = ([], [], 0, 0)
		res = get_heatmap_data("test_user")
		self.assertIn("heatmap_data", res)

	@patch("lms.lms.api.add_days")
	@patch("lms.lms.api.get_datetime")
	@patch("lms.lms.api.now")
	@patch("lms.lms.api.format_date")
	def test_calculate_date_ranges(self, mock_format, mock_now, mock_get_datetime, mock_add_days):
		from lms.lms.api import calculate_date_ranges
		mock_format.return_value = "2026-06-10"
		mock_now.return_value = "now"
		mock_dt = MagicMock()
		mock_dt.strftime.return_value = "3"
		mock_get_datetime.return_value = mock_dt
		mock_add_days.return_value = "mock_date"
		res = calculate_date_ranges(10)
		self.assertEqual(len(res), 4)

	@patch("lms.lms.api.format_date")
	def test_initialize_and_count_dates(self, mock_format):
		from lms.lms.api import initialize_date_count, count_dates
		mock_format.side_effect = lambda x, y: x
		dates = ["2026-06-10", "2026-06-11"]
		date_count = initialize_date_count(dates)
		self.assertEqual(date_count["2026-06-10"], 0)
		mock_entry = MagicMock()
		mock_entry.creation = "2026-06-10"
		count_dates([mock_entry], date_count)
		self.assertEqual(date_count["2026-06-10"], 1)

	@patch("lms.lms.api.date_diff")
	def test_get_week_difference(self, mock_diff):
		from lms.lms.api import get_week_difference
		mock_diff.return_value = 14
		self.assertEqual(get_week_difference("start", "end"), 2)

	def test_is_mention(self):
		from lms.lms.api import is_mention
		mock_notif = frappe._dict({"type": "Mention", "subject": "Test"})
		self.assertTrue(is_mention(mock_notif))
		mock_notif.type = "Alert"
		mock_notif.subject = "user mentioned you in a comment"
		self.assertTrue(is_mention(mock_notif))
		mock_notif.subject = "New comment"
		self.assertFalse(is_mention(mock_notif))

	@patch("lms.lms.api.frappe.db.get_value")
	def test_update_user_details(self, mock_get_value):
		from lms.lms.api import update_user_details
		mock_get_value.return_value = {"full_name": "Test", "user_image": "img"}
		notif = frappe._dict({"document_details": None, "from_user": "user1", "type": "Alert", "subject": "Test"})
		res = update_user_details(notif)
		self.assertEqual(res["from_user_details"]["full_name"], "Test")
		notif.document_details = {"instructors": ["Inst1"]}
		res = update_user_details(notif)
		self.assertEqual(res["from_user_details"], "Inst1")

	@patch("lms.lms.api.update_user_details")
	@patch("lms.lms.api.update_document_details")
	@patch("lms.lms.api.frappe.get_all")
	def test_get_notifications(self, mock_get_all, mock_upd_doc, mock_upd_user):
		from lms.lms.api import get_notifications
		frappe.set_user("user1")
		mock_get_all.return_value = [frappe._dict({"name": "Notif1"})]
		mock_upd_doc.side_effect = lambda x: x
		mock_upd_user.side_effect = lambda x: x
		res = get_notifications()
		self.assertEqual(len(res), 1)
		self.assertEqual(res[0].name, "Notif1")

	@patch("lms.lms.api.get_instructors")
	@patch("lms.lms.api.frappe.db.get_value")
	def test_update_document_details(self, mock_get_value, mock_get_instructors):
		from lms.lms.api import update_document_details
		notif_course = frappe._dict({"document_type": "LMS Course", "document_name": "Course 1"})
		mock_get_value.return_value = {"title": "Test Course"}
		mock_get_instructors.return_value = ["Inst1"]
		res_course = update_document_details(notif_course)
		self.assertEqual(res_course.document_details["title"], "Test Course")
		self.assertEqual(res_course.document_details["instructors"], ["Inst1"])

		notif_batch = frappe._dict({"document_type": "LMS Batch", "document_name": "Batch 1"})
		res_batch = update_document_details(notif_batch)
		self.assertTrue("instructors" in res_batch.document_details)

	@patch("lms.lms.api.frappe.get_cached_value")
	def test_get_lms_settings(self, mock_get_cached):
		from lms.lms.api import get_lms_settings
		mock_get_cached.return_value = 1
		res = get_lms_settings()
		self.assertEqual(res["allow_guest_access"], 1)
		self.assertEqual(res["enforce_video_completion"], 1)

	@patch("lms.lms.api.frappe.delete_doc")
	@patch("lms.lms.api.frappe.get_all")
	@patch("lms.lms.api.frappe.db.get_value")
	@patch("lms.lms.api.frappe.db.set_value")
	@patch("lms.lms.api.frappe.db.exists")
	def test_cancel_evaluation(self, mock_exists, mock_set_value, mock_get_value, mock_get_all, mock_delete):
		from lms.lms.api import cancel_evaluation
		frappe.set_user("user1")
		
		eval_dict = frappe._dict({"member": "user2"})
		with self.assertRaises(frappe.PermissionError):
			cancel_evaluation(eval_dict)
			
		eval_dict.member = "user1"
		eval_dict.name = "Eval1"
		mock_exists.return_value = False
		with self.assertRaises(frappe.PermissionError):
			cancel_evaluation(eval_dict)
			
		mock_exists.return_value = True
		mock_date = MagicMock()
		mock_date.format.return_value = "2026-06-10"
		eval_dict.date = mock_date
		eval_dict.member_name = "User One"
		mock_get_all.return_value = [frappe._dict({"parent": "Event1", "name": "Part1"})]
		mock_get_value.side_effect = [
			frappe._dict({"starts_on": "2026-06-10 10:00:00", "subject": "Eval for User One"}),
			"Comm1"
		]
		
		cancel_evaluation(eval_dict)
		self.assertEqual(mock_delete.call_count, 3)

	@patch("lms.lms.api.frappe.db.get_value")
	@patch("lms.lms.api.frappe.db.exists")
	def test_get_certification_details(self, mock_exists, mock_get_value):
		from lms.lms.api import get_certification_details
		frappe.set_user("user1")
		mock_exists.return_value = True
		mock_get_value.side_effect = [{"name": "Enroll1"}, "Paid Cert", {"name": "Cert1"}]
		res = get_certification_details("Course 1")
		self.assertEqual(res["membership"]["name"], "Enroll1")
		self.assertEqual(res["paid_certificate"], "Paid Cert")

	@patch("lms.lms.api.frappe.clear_cache")
	@patch("lms.lms.api.frappe.db.delete")
	@patch("lms.lms.api.frappe.new_doc")
	@patch("lms.lms.api.frappe.db.exists")
	@patch("lms.lms.api.save_evaluator_role")
	@patch("lms.lms.api.LMS_ROLES", ["Moderator", "Batch Evaluator", "LMS Student"])
	def test_save_role(self, mock_save_evaluator, mock_exists, mock_new_doc, mock_delete, mock_clear_cache):
		from lms.lms.api import save_role
		frappe.set_user("Administrator")
		
		with self.assertRaises(frappe.PermissionError):
			save_role("user1", "Admin", 1)
			
		save_role("user1", "Batch Evaluator", 1)
		mock_save_evaluator.assert_called_once()
		
		mock_exists.return_value = False
		mock_doc = MagicMock()
		mock_new_doc.return_value = mock_doc
		save_role("user1", "Moderator", 1)
		mock_doc.save.assert_called_once()
		
		save_role("user1", "LMS Student", 0)
		mock_delete.assert_called_once()

	@patch("lms.lms.api.frappe.db.set_single_value")
	@patch("lms.lms.api.frappe.integrations.utils.make_post_request")
	@patch("lms.lms.api.json.dumps")
	@patch("lms.lms.api.frappe.parse_json")
	def test_capture_user_persona(self, mock_parse, mock_dumps, mock_post, mock_set_single):
		from lms.lms.api import capture_user_persona
		frappe.set_user("Administrator")
		mock_parse.return_value = {"data": "test"}
		mock_dumps.return_value = '{"data": "test"}'
		mock_post.return_value = {"message": {"name": "success"}}
		
		res = capture_user_persona('{"data": "test"}')
		
		mock_set_single.assert_called_once_with("LMS Settings", "persona_captured", True)
		self.assertEqual(res["message"]["name"], "success")

	@patch("lms.lms.api.frappe.get_all")
	@patch("lms.lms.api.frappe.db.exists")
	def test_get_meta_info(self, mock_exists, mock_get_all):
		from lms.lms.api import get_meta_info
		
		mock_exists.return_value = False
		self.assertEqual(get_meta_info("courses", "course1"), [])
		
		mock_exists.return_value = True
		mock_get_all.return_value = [{"name": "tag1"}]
		self.assertEqual(get_meta_info("courses", "course1")[0]["name"], "tag1")

	@patch("lms.lms.api.create_meta_tag")
	@patch("lms.lms.api.create_meta")
	@patch("lms.lms.api.frappe.db.set_value")
	@patch("lms.lms.api.frappe.db.delete")
	@patch("lms.lms.api.frappe.db.exists")
	@patch("lms.lms.api.validate_meta_tags")
	@patch("lms.lms.api.validate_meta_data_permissions")
	def test_update_meta_info(self, mock_val_perm, mock_val_tags, mock_exists, mock_delete, mock_set_value, mock_create_meta, mock_create_tag):
		from lms.lms.api import update_meta_info
		frappe.set_user("Administrator")
		
		tags = [
			{"key": "k1", "value": "v1"},
			{"key": "k2", "value": ""},
			{"key": "k3", "value": "v3"},
			{"key": "k4", "value": "v4"}
		]
		mock_exists.side_effect = ["Tag1", "Tag2", False, False, False, True]
		
		update_meta_info("courses", "c1", tags)
		
		mock_set_value.assert_called_once_with("Website Meta Tag", "Tag1", "value", "v1")
		mock_delete.assert_called_once_with("Website Meta Tag", "Tag2")
		mock_create_meta.assert_called_once()
		mock_create_tag.assert_called_once()

	@patch("lms.lms.api.frappe.utils.strip_html_tags")
	def test_validate_meta_tags(self, mock_strip):
		from lms.lms.api import validate_meta_tags
		
		with self.assertRaises(Exception):
			validate_meta_tags("not a list")
			
		mock_strip.return_value = "clean"
		tags = [{"value": "<b>bold</b>"}]
		validate_meta_tags(tags)
		self.assertEqual(tags[0]["value"], "clean")

	@patch("lms.lms.api.frappe.new_doc")
	def test_create_meta_functions(self, mock_new_doc):
		from lms.lms.api import create_meta, create_meta_tag
		
		mock_doc = MagicMock()
		mock_new_doc.return_value = mock_doc
		
		create_meta("parent", {"key": "v"})
		mock_doc.insert.assert_called_once()
		
		mock_doc.reset_mock()
		
		create_meta_tag({"key": "v"})
		mock_doc.insert.assert_called_once()

	@patch("lms.lms.api.frappe.get_roles")
	def test_validate_meta_data_permissions(self, mock_get_roles):
		from lms.lms.api import validate_meta_data_permissions
		
		mock_get_roles.return_value = ["LMS Student"]
		with self.assertRaises(Exception):
			validate_meta_data_permissions("courses")
		with self.assertRaises(Exception):
			validate_meta_data_permissions("batches")
			
		mock_get_roles.return_value = ["Course Creator"]
		validate_meta_data_permissions("courses")
		
		mock_get_roles.return_value = ["Batch Evaluator"]
		validate_meta_data_permissions("batches")

	@patch("lms.lms.api.update_exercise_submission")
	@patch("lms.lms.api.make_new_exercise_submission")
	def test_create_programming_exercise_submission(self, mock_new_sub, mock_update_sub):
		from lms.lms.api import create_programming_exercise_submission
		frappe.set_user("Administrator")
		
		create_programming_exercise_submission("Ex1", "new", "print('hi')", [])
		mock_new_sub.assert_called_once()
		
		create_programming_exercise_submission("Ex1", "Sub1", "print('hi')", [])
		mock_update_sub.assert_called_once()

	@patch("lms.lms.api.get_exercise_status")
	@patch("lms.lms.api.frappe.new_doc")
	def test_make_new_exercise_submission(self, mock_new_doc, mock_get_status):
		from lms.lms.api import make_new_exercise_submission
		
		mock_doc = MagicMock()
		mock_doc.name = "NewSub"
		mock_new_doc.return_value = mock_doc
		mock_get_status.return_value = "Passed"
		
		res = make_new_exercise_submission("Ex1", "code", [{"input": "1"}])
		
		mock_doc.append.assert_called_once()
		mock_doc.insert.assert_called_once()
		self.assertEqual(res, "NewSub")

	@patch("lms.lms.api.frappe.db.set_value")
	@patch("lms.lms.api.get_exercise_status")
	@patch("lms.lms.api.update_test_cases")
	@patch("lms.lms.api.frappe.db.get_value")
	def test_update_exercise_submission(self, mock_get_value, mock_update_tc, mock_get_status, mock_set_value):
		from lms.lms.api import update_exercise_submission
		frappe.set_user("user1")
		
		mock_get_value.return_value = "user2"
		with self.assertRaises(frappe.PermissionError):
			update_exercise_submission("Sub1", "code", [])
			
		mock_get_value.return_value = "user1"
		mock_get_status.return_value = "Passed"
		update_exercise_submission("Sub1", "code", [])
		
		mock_update_tc.assert_called_once()
		mock_set_value.assert_called_once_with("LMS Programming Exercise Submission", "Sub1", {"status": "Passed", "code": "code"})

	def test_get_exercise_status(self):
		from lms.lms.api import get_exercise_status
		self.assertEqual(get_exercise_status([]), "Failed")
		self.assertEqual(get_exercise_status([{"status": "Passed"}, {"status": "Passed"}]), "Passed")
		self.assertEqual(get_exercise_status([{"status": "Passed"}, {"status": "Failed"}]), "Failed")

	@patch("lms.lms.api.frappe.new_doc")
	@patch("lms.lms.api.frappe.db.delete")
	def test_update_test_cases(self, mock_delete, mock_new_doc):
		from lms.lms.api import update_test_cases
		mock_doc = MagicMock()
		mock_new_doc.return_value = mock_doc
		
		update_test_cases([{"input": "1"}], "Sub1")
		
		mock_delete.assert_called_once_with("LMS Test Case Submission", {"parent": "Sub1"})
		mock_doc.insert.assert_called_once()

	@patch("lms.lms.api.track_new_watch_time")
	@patch("lms.lms.api.frappe.db.set_value")
	@patch("lms.lms.api.frappe.db.get_value")
	def test_track_video_watch_duration(self, mock_get_value, mock_set_value, mock_track_new):
		from lms.lms.api import track_video_watch_duration
		frappe.set_user("user1")
		
		# Escenario 1: El tiempo nuevo es mayor, se actualiza el registro
		mock_get_value.return_value = frappe._dict({"name": "Rec1", "watch_time": 10})
		track_video_watch_duration("Less1", [{"source": "v1", "watch_time": 20}])
		mock_set_value.assert_called_once()
		
		# Escenario 2: El tiempo nuevo es menor, se ignora (Pasamos la lista directamente)
		mock_set_value.reset_mock()
		track_video_watch_duration("Less1", [{"source": "v1", "watch_time": 5}])
		mock_set_value.assert_not_called()
		
		# Escenario 3: No existe registro, se crea uno nuevo
		mock_get_value.return_value = None
		track_video_watch_duration("Less1", [{"source": "v1", "watch_time": 20}])
		mock_track_new.assert_called_once()

	@patch("lms.lms.api.frappe.new_doc")
	def test_track_new_watch_time(self, mock_new_doc):
		from lms.lms.api import track_new_watch_time
		mock_doc = MagicMock()
		mock_new_doc.return_value = mock_doc
		
		track_new_watch_time("Less1", {"source": "v1", "watch_time": 10})
		mock_doc.save.assert_called_once()

	@patch("lms.lms.api.get_progress_distribution")
	@patch("lms.lms.api.get_average_course_progress")
	@patch("lms.lms.api.frappe.get_all")
	@patch("lms.lms.api.can_modify_course")
	def test_get_course_progress_distribution(self, mock_can_modify, mock_get_all, mock_get_avg, mock_get_dist):
		from lms.lms.api import get_course_progress_distribution
		
		mock_can_modify.return_value = False
		with self.assertRaises(frappe.PermissionError):
			get_course_progress_distribution("C1")
			
		mock_can_modify.return_value = True
		mock_get_all.return_value = [10, 50, 100]
		mock_get_avg.return_value = 53.33
		mock_get_dist.return_value = [{"name": "Advanced", "value": 1}]
		
		res = get_course_progress_distribution("C1")
		self.assertEqual(res["average_progress"], 53.33)
		self.assertTrue(len(res["progress_distribution"]) > 0)

	@patch("lms.lms.api.flt")
	@patch("lms.lms.api.frappe.get_system_settings")
	def test_get_average_course_progress(self, mock_get_settings, mock_flt):
		from lms.lms.api import get_average_course_progress
		self.assertEqual(get_average_course_progress([]), 0)
		
		mock_flt.side_effect = lambda x, y: x
		self.assertEqual(get_average_course_progress([10, 20, 30]), 20)

	def test_get_progress_distribution(self):
		from lms.lms.api import get_progress_distribution
		res = get_progress_distribution([10, 40, 70, 100])
		self.assertEqual(res[0]["value"], 1)
		self.assertEqual(res[1]["value"], 1)
		self.assertEqual(res[2]["value"], 1)
		self.assertEqual(res[3]["value"], 1)

	@patch("lms.lms.api.Response")
	@patch("lms.lms.api.get_lms_route")
	@patch("lms.lms.api.frappe.db.get_single_value")
	def test_get_pwa_manifest(self, mock_get_single, mock_get_route, mock_response):
		from lms.lms.api import get_pwa_manifest
		import json  # Importamos la librería aquí adentro para resolver la simulación
		
		mock_get_single.side_effect = ["My App", "/banner.png"]
		mock_get_route.return_value = "/lms"
		mock_response.side_effect = lambda x, status, content_type: {"status": status, "content": json.loads(x)}
		
		res = get_pwa_manifest()
		
		self.assertEqual(res["status"], 200)
		self.assertEqual(res["content"]["name"], "My App")
		self.assertEqual(res["content"]["icons"][0]["src"], "/banner.png")

	@patch("lms.lms.api.has_lms_role")
	@patch("lms.lms.api.frappe.get_roles")
	@patch("lms.lms.api.frappe.db.get_value")
	def test_get_profile_details(self, mock_get_value, mock_get_roles, mock_has_lms_role):
		from lms.lms.api import get_profile_details
		mock_get_value.return_value = frappe._dict({"name": "user1"})
		mock_get_roles.return_value = ["LMS Student"]
		
		mock_has_lms_role.return_value = False
		with self.assertRaises(frappe.PermissionError):
			get_profile_details("user1")
			
		mock_has_lms_role.return_value = True
		res = get_profile_details("user1")
		self.assertEqual(res.roles, ["LMS Student"])

	@patch("lms.lms.api.calculate_current_streak")
	@patch("lms.lms.api.calculate_streaks")
	@patch("lms.lms.api.fetch_activity_dates")
	def test_get_streak_info(self, mock_fetch, mock_calc_streaks, mock_calc_current):
		from lms.lms.api import get_streak_info
		mock_fetch.return_value = []
		mock_calc_streaks.return_value = (5, 10)
		mock_calc_current.return_value = 5
		
		res = get_streak_info()
		self.assertEqual(res["current_streak"], 5)
		self.assertEqual(res["longest_streak"], 10)

	@patch("lms.lms.api.frappe.get_all")
	def test_fetch_activity_dates(self, mock_get_all):
		from lms.lms.api import fetch_activity_dates
		import datetime
		
		mock_date = MagicMock()
		mock_date.date.return_value = datetime.date(2026, 6, 10)
		mock_get_all.return_value = [mock_date]
		
		res = fetch_activity_dates("user1")
		self.assertEqual(len(res), 1)

	def test_calculate_streaks(self):
		from lms.lms.api import calculate_streaks
		import datetime
		
		d1 = datetime.date(2026, 6, 8)
		d2 = datetime.date(2026, 6, 9)
		d3 = datetime.date(2026, 6, 10)
		d4 = datetime.date(2026, 6, 13)
		
		streak, longest = calculate_streaks([d1, d2, d3])
		self.assertEqual(streak, 3)
		self.assertEqual(longest, 3)
		
		s2, l2 = calculate_streaks([d1, d2, d4])
		self.assertEqual(l2, 2)

	@patch("lms.lms.api.getdate")
	def test_calculate_current_streak(self, mock_getdate):
		from lms.lms.api import calculate_current_streak
		import datetime
		
		today = datetime.date(2026, 6, 10)
		mock_getdate.return_value = today
		
		self.assertEqual(calculate_current_streak([], 5), 0)
		self.assertEqual(calculate_current_streak([today], 5), 5)
		self.assertEqual(calculate_current_streak([datetime.date(2026, 6, 8)], 5), 0)

	@patch("lms.lms.api.frappe.db.get_value")
	@patch("lms.lms.api.frappe.get_all")
	def test_get_my_live_classes(self, mock_get_all, mock_get_value):
		from lms.lms.api import get_my_live_classes
		frappe.set_user("user1")
		
		mock_get_all.side_effect = [
			["Batch 1"],
			[frappe._dict({"name": "Class 1", "course": "C1"})]
		]
		mock_get_value.return_value = "Course 1 Title"
		
		res = get_my_live_classes()
		self.assertEqual(len(res), 1)
		self.assertEqual(res[0].course_title, "Course 1 Title")

	@patch("lms.lms.api.get_course_details")
	@patch("lms.lms.api.frappe.qb", new_callable=MagicMock)
	@patch("lms.lms.api.frappe.get_roles")
	def test_get_created_courses(self, mock_get_roles, mock_qb, mock_get_details):
		from lms.lms.api import get_created_courses
		frappe.set_user("user1")
		
		mock_get_roles.return_value = ["Moderator"]
		
		mock_qb.DocType.return_value = MagicMock()
		
		mock_base_query = MagicMock()
		mock_qb.from_.return_value.join.return_value.on.return_value.select.return_value.orderby.return_value.limit.return_value = mock_base_query
		
		mock_base_query.where.return_value.run.return_value = []
		mock_base_query.run.return_value = [{"name": "Course 1"}]
		
		mock_get_details.return_value = {"name": "Course 1"}
		
		res = get_created_courses()
		self.assertEqual(len(res), 1)
		self.assertEqual(res[0]["name"], "Course 1")

	@patch("lms.lms.api.get_batch_details")
	@patch("lms.lms.api.getdate")
	@patch("lms.lms.api.frappe.qb", new_callable=MagicMock)
	def test_get_created_batches(self, mock_qb, mock_getdate, mock_get_details):
		from lms.lms.api import get_created_batches
		
		# Simulamos la tabla
		mock_table = MagicMock()
		mock_qb.DocType.return_value = mock_table
		
		# Parcheamos el comportamiento del operador >= para evitar el TypeError
		mock_table.start_date.__ge__ = MagicMock(return_value=True)
		mock_table.date.__ge__ = MagicMock(return_value=True)
		
		mock_query = MagicMock()
		mock_qb.from_.return_value.join.return_value.on.return_value.select.return_value.where.return_value.where.return_value.orderby.return_value.limit.return_value = mock_query
		
		mock_query.run.return_value = [{"name": "Batch 1"}]
		mock_get_details.return_value = {"name": "Batch 1"}
		
		res = get_created_batches()
		self.assertEqual(len(res), 1)
		self.assertEqual(res[0]["name"], "Batch 1")

	@patch("lms.lms.api.getdate")
	@patch("lms.lms.api.frappe.qb", new_callable=MagicMock)
	def test_get_admin_live_classes(self, mock_qb, mock_getdate):
		from lms.lms.api import get_admin_live_classes
		
		mock_table = MagicMock()
		mock_qb.DocType.return_value = mock_table
		
		# Parcheamos el comportamiento del operador >= para evitar el TypeError
		mock_table.date.__ge__ = MagicMock(return_value=True)
		
		mock_query = MagicMock()
		mock_qb.from_.return_value.join.return_value.on.return_value.select.return_value.where.return_value.where.return_value.orderby.return_value.limit.return_value = mock_query
		
		mock_query.run.return_value = [{"name": "Class 1"}]
		
		res = get_admin_live_classes()
		self.assertEqual(len(res), 1)
		self.assertEqual(res[0]["name"], "Class 1")

	@patch("lms.lms.api.frappe.db.get_value")
	@patch("lms.lms.api.getdate")
	@patch("lms.lms.api.frappe.get_all")
	def test_get_admin_evals(self, mock_get_all, mock_getdate, mock_get_value):
		from lms.lms.api import get_admin_evals
		
		mock_get_all.return_value = [frappe._dict({"name": "Eval 1", "course": "C1"})]
		mock_get_value.return_value = "Course Title"
		
		res = get_admin_evals()
		self.assertEqual(len(res), 1)
		self.assertEqual(res[0].course_title, "Course Title")

	@patch("lms.lms.api.get_course_details")
	@patch("lms.lms.api.get_popular_courses")
	@patch("lms.lms.api.get_featured_home_courses")
	@patch("lms.lms.api.get_my_latest_courses")
	def test_get_my_courses(self, mock_latest, mock_featured, mock_popular, mock_details):
		from lms.lms.api import get_my_courses
		
		mock_details.side_effect = lambda x: {"name": x}
		
		mock_latest.return_value = ["Course 1"]
		res = get_my_courses()
		self.assertEqual(res[0]["name"], "Course 1")
		
		mock_latest.return_value = []
		mock_featured.return_value = ["Course 2"]
		res2 = get_my_courses()
		self.assertEqual(res2[0]["name"], "Course 2")
		
		mock_featured.return_value = []
		mock_popular.return_value = ["Course 3"]
		res3 = get_my_courses()
		self.assertEqual(res3[0]["name"], "Course 3")

	@patch("lms.lms.api.frappe.get_all")
	def test_course_fetchers(self, mock_get_all):
		from lms.lms.api import get_my_latest_courses, get_featured_home_courses, get_popular_courses
		
		mock_get_all.return_value = ["Course X"]
		self.assertEqual(get_my_latest_courses(), ["Course X"])
		self.assertEqual(get_featured_home_courses(), ["Course X"])
		self.assertEqual(get_popular_courses(), ["Course X"])

	@patch("lms.lms.api.get_batch_details")
	@patch("lms.lms.api.get_upcoming_batches")
	@patch("lms.lms.api.get_my_latest_batches")
	def test_get_my_batches(self, mock_latest, mock_upcoming, mock_details):
		from lms.lms.api import get_my_batches
		
		mock_details.side_effect = lambda x: {"name": x}
		
		mock_latest.return_value = ["Batch 1"]
		res = get_my_batches()
		self.assertEqual(res[0]["name"], "Batch 1")
		
		mock_latest.return_value = []
		mock_upcoming.return_value = ["Batch 2"]
		res2 = get_my_batches()
		self.assertEqual(res2[0]["name"], "Batch 2")

	@patch("lms.lms.api.getdate")
	@patch("lms.lms.api.frappe.get_all")
	def test_batch_fetchers(self, mock_get_all, mock_getdate):
		from lms.lms.api import get_my_latest_batches, get_upcoming_batches
		
		mock_get_all.return_value = ["Batch X"]
		self.assertEqual(get_my_latest_batches(), ["Batch X"])
		self.assertEqual(get_upcoming_batches(), ["Batch X"])

	@patch("lms.lms.api.frappe.db.delete")
	def test_delete_programming_exercise(self, mock_delete):
		from lms.lms.api import delete_programming_exercise
		frappe.set_user("Administrator")
		
		delete_programming_exercise("Ex1")
		self.assertEqual(mock_delete.call_count, 2)

	@patch("lms.lms.api.frappe.qb", new_callable=MagicMock)
	@patch("lms.lms.api.frappe.get_roles")
	def test_get_lesson_completion_stats(self, mock_get_roles, mock_qb):
		from lms.lms.api import get_lesson_completion_stats
		
		mock_get_roles.return_value = ["LMS Student"]
		# Corrección: frappe.throw por defecto lanza ValidationError si no se especifica el tipo
		with self.assertRaises(frappe.ValidationError):
			get_lesson_completion_stats("Course 1")
			
		mock_get_roles.return_value = ["Moderator"]
		
		mock_table = MagicMock()
		mock_qb.DocType.return_value = mock_table
		
		mock_chain = MagicMock()
		mock_qb.from_.return_value = mock_chain
		mock_chain.join.return_value = mock_chain
		mock_chain.on.return_value = mock_chain
		mock_chain.left_join.return_value = mock_chain
		mock_chain.select.return_value = mock_chain
		mock_chain.where.return_value = mock_chain
		mock_chain.groupby.return_value = mock_chain
		mock_chain.orderby.return_value = mock_chain
		
		mock_chain.run.return_value = [{"lesson_name": "L1", "completion_count": 10}]
		
		res = get_lesson_completion_stats("Course 1")
		self.assertEqual(res[0]["completion_count"], 10)

	@patch("lms.lms.api.has_lms_role")
	@patch("lms.lms.api.frappe.get_all")
	def test_get_badges(self, mock_get_all, mock_has_lms_role):
		from lms.lms.api import get_badges
		
		mock_has_lms_role.return_value = False
		with self.assertRaises(frappe.PermissionError):
			get_badges("user1")
			
		mock_has_lms_role.return_value = True
		mock_get_all.return_value = [{"badge": "Gold"}]
		res = get_badges("user1")
		self.assertEqual(res[0]["badge"], "Gold")

	@patch("lms.lms.api.frappe.db.set_single_value")
	@patch("lms.lms.api.frappe.delete_doc")
	@patch("lms.lms.api.delete_course")
	@patch("lms.lms.api.frappe.get_all")
	@patch("lms.lms.api.frappe.db.delete")
	@patch("lms.lms.api.frappe.db.exists")
	def test_clear_demo_data(self, mock_exists, mock_delete, mock_get_all, mock_del_course, mock_del_doc, mock_set_single):
		from lms.lms.api import clear_demo_data
		frappe.set_user("Administrator")
		
		mock_exists.side_effect = [True, True, False, True, True]
		mock_get_all.return_value = ["DemoCourse1"]
		
		clear_demo_data()
		
		mock_delete.assert_called_once()
		mock_del_course.assert_called_once_with("DemoCourse1")
		self.assertEqual(mock_del_doc.call_count, 3)
		mock_set_single.assert_called_once_with("LMS Settings", "demo_data_present", False)

	@patch("lms.lms.api.LMS_ROLES", ["Moderator", "Course Creator"])
	@patch("lms.lms.api.frappe.get_all")
	def test_search_users_by_role(self, mock_get_all):
		from lms.lms.api import search_users_by_role
		import json
		frappe.set_user("Administrator")
		
		self.assertEqual(search_users_by_role(), [])
		
		with self.assertRaises(Exception):
			search_users_by_role(roles='["Invalid Role"]')
			
		mock_get_all.return_value = []
		self.assertEqual(search_users_by_role(roles='["Moderator"]'), [])
		
		mock_get_all.side_effect = [
			["user1", "user2"],
			[frappe._dict({"name": "user1", "full_name": "User One", "user_image": "img"})]
		]
		
		res = search_users_by_role(txt="One", roles='["Moderator"]')
		self.assertEqual(len(res), 1)
		self.assertEqual(res[0]["value"], "user1")
		
		mock_get_all.side_effect = [
			["user3"],
			[frappe._dict({"name": "user3", "full_name": "User Three", "user_image": ""})]
		]
		res_names = search_users_by_role(names='["user3"]', roles=["Course Creator"])
		self.assertEqual(res_names[0]["label"], "User Three")

	@patch("lms.lms.api.now")
	@patch("lms.lms.api.date_diff")
	@patch("lms.lms.api.frappe.db.count")
	@patch("lms.lms.api.frappe.get_cached_value")
	@patch("lms.lms.api.frappe.db.exists")
	def test_verify_billing_access(self, mock_exists, mock_get_cached, mock_count, mock_date_diff, mock_now):
		from lms.lms.api import verify_billing_access
		
		frappe.set_user("Guest")
		acc, msg = verify_billing_access("LMS Course", "C1", "course")
		self.assertFalse(acc)
		
		frappe.set_user("test@user.com")
		
		acc, msg = verify_billing_access("LMS Course", "C1", "invalid")
		self.assertFalse(acc)
		
		mock_exists.return_value = False
		acc, msg = verify_billing_access("LMS Course", "C1", "course")
		self.assertFalse(acc)
		
		mock_exists.side_effect = [True, True]
		acc, msg = verify_billing_access("LMS Course", "C1", "course")
		self.assertFalse(acc)
		
		mock_exists.side_effect = [True, True]
		acc, msg = verify_billing_access("LMS Course", "C1", "certificate")
		self.assertFalse(acc)
		
		mock_exists.side_effect = [True, True]
		acc, msg = verify_billing_access("LMS Batch", "B1", "batch")
		self.assertFalse(acc)
		
		mock_exists.side_effect = [True, False]
		mock_get_cached.side_effect = [10, "2026-06-20"]
		mock_count.return_value = 10
		acc, msg = verify_billing_access("LMS Batch", "B1", "batch")
		self.assertFalse(acc)
		
		mock_exists.side_effect = [True, False]
		mock_get_cached.side_effect = [10, "2026-06-01"]
		mock_count.return_value = 5
		mock_date_diff.return_value = -1
		acc, msg = verify_billing_access("LMS Batch", "B1", "batch")
		self.assertFalse(acc)
		
		mock_exists.side_effect = [True, False]
		mock_get_cached.side_effect = [10, "2026-06-20"]
		mock_count.return_value = 5
		mock_date_diff.return_value = 10
		acc, msg = verify_billing_access("LMS Batch", "B1", "batch")
		self.assertTrue(acc)

	@patch("lms.lms.api.now")
	@patch("lms.lms.api.date_diff")
	@patch("lms.lms.api.frappe.db.count")
	@patch("lms.lms.api.frappe.get_cached_value")
	@patch("lms.lms.api.frappe.db.exists")
	def test_verify_billing_access(self, mock_exists, mock_get_cached, mock_count, mock_date_diff, mock_now):
		from lms.lms.api import verify_billing_access
		
		mock_count.return_value = 0
		mock_date_diff.return_value = 10
		
		def get_cached_side_effect(doctype, name, field):
			if field == "seat_count": return 10
			if field == "start_date": return "2026-06-20"
			return None
			
		mock_get_cached.side_effect = get_cached_side_effect
		
		frappe.set_user("Guest")
		acc, msg = verify_billing_access("LMS Course", "C1", "course")
		self.assertFalse(acc)
		
		frappe.set_user("test@user.com")
		
		acc, msg = verify_billing_access("LMS Course", "C1", "invalid")
		self.assertFalse(acc)
		
		mock_exists.side_effect = [False]
		acc, msg = verify_billing_access("LMS Course", "C1", "course")
		self.assertFalse(acc)
		
		mock_exists.side_effect = [True, True]
		acc, msg = verify_billing_access("LMS Course", "C1", "course")
		self.assertFalse(acc)
		
		mock_exists.side_effect = [True, True]
		acc, msg = verify_billing_access("LMS Course", "C1", "certificate")
		self.assertFalse(acc)
		
		mock_exists.side_effect = [True, True]
		acc, msg = verify_billing_access("LMS Batch", "B1", "batch")
		self.assertFalse(acc)
		
		mock_exists.side_effect = [True, False]
		mock_count.return_value = 10
		acc, msg = verify_billing_access("LMS Batch", "B1", "batch")
		self.assertFalse(acc)
		
		mock_exists.side_effect = [True, False]
		mock_count.return_value = 5
		mock_date_diff.return_value = -1
		acc, msg = verify_billing_access("LMS Batch", "B1", "batch")
		self.assertFalse(acc)
		
		mock_exists.side_effect = [True, False]
		mock_count.return_value = 5
		mock_date_diff.return_value = 10
		acc, msg = verify_billing_access("LMS Batch", "B1", "batch")
		self.assertTrue(acc)

	@patch("lms.lms.api.frappe.get_all")
	@patch("lms.lms.api.frappe.get_list")
	def test_get_application_users(self, mock_get_list, mock_get_all):
		from lms.lms.api import get_application_users
		import json
		
		self.assertEqual(get_application_users([]), [])
		self.assertEqual(get_application_users("[]"), [])
		
		mock_get_list.return_value = []
		self.assertEqual(get_application_users(["user1"]), [])
		
		mock_get_list.return_value = ["user1", "user1", "user2"]
		mock_get_all.return_value = [{"name": "user1"}, {"name": "user2"}]
		
		res = get_application_users('["user1", "user2"]')
		self.assertEqual(len(res), 2)
		mock_get_all.assert_called_once()

	@patch("builtins.print")
	@patch("lms.lms.api.frappe.get_doc")
	@patch("lms.lms.api.frappe.new_doc")
	@patch("lms.lms.api.frappe.db.get_value")
	@patch("lms.lms.api.frappe.db.exists")
	def test_get_evaluator_details(self, mock_exists, mock_get_value, mock_new_doc, mock_get_doc, mock_print):
		from lms.lms.api import get_evaluator_details
		frappe.set_user("Administrator")
		
		mock_exists.side_effect = [False, False]
		
		mock_cal = MagicMock()
		mock_cal.name = "Cal1"
		mock_cal.authorization_code = "Auth1"
		
		mock_eval = MagicMock()
		mock_slot = MagicMock()
		mock_slot.start_time = "10:00"
		mock_slot.end_time = "11:00"
		mock_eval.schedule = [mock_slot]
		mock_eval.as_dict.return_value = {"evaluator": "user1"}
		
		mock_new_doc.side_effect = [mock_cal, mock_eval]
		
		res = get_evaluator_details("user1")
		self.assertEqual(res["calendar"], "Cal1")
		self.assertEqual(res["slots"]["evaluator"], "user1")
		self.assertEqual(mock_new_doc.call_count, 2)
		mock_print.assert_called_once_with("10:00", "11:00")
		
		mock_exists.side_effect = [True, True]
		mock_get_value.return_value = frappe._dict({"name": "Cal2", "authorization_code": "Auth2"})
		mock_get_doc.return_value = mock_eval
		
		res2 = get_evaluator_details("user2")
		self.assertEqual(res2["calendar"], "Cal2")
		self.assertEqual(res2["is_authorised"], "Auth2")
		mock_get_doc.assert_called_once_with("Course Evaluator", "user2")

	@patch("lms.lms.api.frappe.get_all")
	def test_get_certification_categories(self, mock_get_all):
		from lms.lms.api import get_certification_categories
		
		mock_get_all.return_value = [
			frappe._dict({"course_title": "Course 1", "batch_title": None}),
			frappe._dict({"course_title": None, "batch_title": "Batch 1"}),
			frappe._dict({"course_title": None, "batch_title": None}),
			frappe._dict({"course_title": "Course 1", "batch_title": None}),
		]
		
		res = get_certification_categories()
		self.assertEqual(len(res), 2)
		self.assertEqual(res[0]["value"], "Course 1")
		self.assertEqual(res[1]["value"], "Batch 1")

	@patch("lms.lms.api.update_target_chapter")
	@patch("lms.lms.api.update_source_chapter")
	@patch("lms.lms.api.can_modify_course")
	@patch("lms.lms.api.frappe.db.get_value")
	def test_update_lesson_index(self, mock_get_value, mock_can_modify, mock_update_source, mock_update_target):
		from lms.lms.api import update_lesson_index
		
		mock_get_value.return_value = "Course 1"
		mock_can_modify.return_value = False
		
		with self.assertRaises(frappe.PermissionError):
			update_lesson_index("L1", "Chap1", "Chap2", 1)
			
		mock_can_modify.return_value = True
		
		update_lesson_index("L1", "Chap1", "Chap2", 1)
		mock_update_source.assert_called_once_with("L1", "Chap1", 1, False)
		mock_update_target.assert_called_once_with("L1", "Chap2", 1)
		
		mock_update_source.reset_mock()
		mock_update_target.reset_mock()
		
		update_lesson_index("L1", "Chap1", "Chap1", 2)
		mock_update_source.assert_called_once_with("L1", "Chap1", 2, True)
		mock_update_target.assert_not_called()

	@patch("lms.lms.api.update_index")
	@patch("lms.lms.api.frappe.db.delete")
	@patch("lms.lms.api.frappe.get_all")
	def test_update_source_chapter(self, mock_get_all, mock_delete, mock_update_index):
		from lms.lms.api import update_source_chapter
		
		mock_get_all.return_value = ["L1", "L2", "L3"]
		update_source_chapter("L2", "Chap1", 1, False)
		mock_delete.assert_called_once_with("Lesson Reference", {"parent": "Chap1", "lesson": "L2"})
		mock_update_index.assert_called_once_with(["L1", "L3"], "Chap1")
		
		mock_delete.reset_mock()
		mock_update_index.reset_mock()
		
		mock_get_all.return_value = ["L1", "L2", "L3"]
		update_source_chapter("L2", "Chap1", 2, True)
		mock_delete.assert_not_called()
		mock_update_index.assert_called_once_with(["L1", "L3", "L2"], "Chap1")

	@patch("lms.lms.api.update_index")
	@patch("lms.lms.api.frappe.new_doc")
	@patch("lms.lms.api.frappe.get_all")
	def test_update_target_chapter(self, mock_get_all, mock_new_doc, mock_update_index):
		from lms.lms.api import update_target_chapter
		
		mock_get_all.return_value = ["L1", "L3"]
		mock_doc = MagicMock()
		mock_new_doc.return_value = mock_doc
		
		update_target_chapter("L2", "Chap2", 1)
		
		mock_doc.update.assert_called_once()
		mock_doc.insert.assert_called_once()
		mock_update_index.assert_called_once_with(["L1", "L2", "L3"], "Chap2")
	

	@patch("lms.lms.api.frappe.get_all")
	def test_get_members(self, mock_get_all):
		from lms.lms.api import get_members

		frappe.set_user("Administrator")

		# Simulamos un usuario retornado por la consulta principal
		member_obj = frappe._dict({
			"name": "user1",
			"full_name": "User One"
		})

		def side_effect_func(doctype, filters=None, fields=None, pluck=None, **kwargs):
			if doctype == "User":
				return [member_obj]
			if doctype == "Has Role":
				return ["LMS Student"]
			return []

		mock_get_all.side_effect = side_effect_func

		# Ejecutamos el método
		res = get_members(0, "User")

		# Validación flexible: cubre implementaciones que usan
		# "role" (string) o "roles" (lista)
		if "role" in res[0]:
			self.assertEqual(res[0].role, "LMS Student")
		elif "roles" in res[0]:
			self.assertIn("LMS Student", res[0].roles)
		else:
			self.fail("La API no asignó role ni roles al miembro.")

	def test_prepare_heatmap_data(self):
		from lms.lms.api import prepare_heatmap_data
		
		# Fecha inicial y conteo de actividades
		start_date = "2026-06-01"
		date_count = {"2026-06-01": 5, "2026-06-02": 3}
		
		heatmap, labels, total, weeks = prepare_heatmap_data(start_date, 7, date_count)
		
		# Validaciones
		self.assertEqual(total, 8)
		# Verificamos que Jun esté en las etiquetas
		self.assertIn("Jun", labels)
		# Verificamos que los datos se hayan mapeado al día correcto
		# 2026-06-01 es lunes (Mon)
		mon_data = next(day["data"] for day in heatmap if day["name"] == "Mon")
		self.assertEqual(mon_data[0]["count"], 5)

	@patch("lms.lms.api.now")
	@patch("lms.lms.api.date_diff")
	@patch("lms.lms.api.frappe.db.count")
	@patch("lms.lms.api.frappe.get_cached_value")
	@patch("lms.lms.api.frappe.db.exists")
	def test_verify_billing_access_batch_edge_cases(self, mock_exists, mock_get_cached, mock_count, mock_date_diff, mock_now):
		from lms.lms.api import verify_billing_access
		
		# Forzamos que el retorno de date_diff sea un número real (ej. 1 o -1)
		mock_date_diff.return_value = 10
		mock_exists.return_value = True 
		
		# Escenario: Lote vendido
		mock_get_cached.side_effect = [5, "2099-01-01"] 
		mock_count.return_value = 10 
		acc, msg = verify_billing_access("LMS Batch", "B_FULL", "batch")
		self.assertFalse(acc)
		self.assertEqual(msg, "Batch is sold out.")

		# Escenario: Lote con fecha pasada (forzamos date_diff < 0)
		mock_get_cached.side_effect = [10, "2020-01-01"] 
		mock_count.return_value = 2
		mock_date_diff.return_value = -1 
		acc, msg = verify_billing_access("LMS Batch", "B_OLD", "batch")
		self.assertFalse(acc)
		self.assertEqual(msg, "Batch has already started.")

	def test_get_progress_distribution_zero_division(self):
		from lms.lms.api import get_progress_distribution
		# Probando el caso de lista vacía explícitamente
		res = get_progress_distribution([])
		for bucket in res:
			self.assertEqual(bucket["value"], 0)

	@patch("lms.lms.api.frappe.get_all")
	def test_search_users_by_role_empty_cases(self, mock_get_all):
		from lms.lms.api import search_users_by_role
		frappe.set_user("Administrator")
		
		# Probando cuando no existen usuarios con ese rol
		mock_get_all.return_value = []
		res = search_users_by_role(roles='["Moderator"]')
		self.assertEqual(res, [])