# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

from datetime import datetime
import json
from unittest.mock import MagicMock, patch

import frappe
from frappe import _dict
from frappe.utils import getdate, to_timedelta

from lms.lms.doctype.lms_certificate.lms_certificate import is_certified
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import (
	apply_gst,
	build_outline,
	can_modify_batch,
	can_modify_course,
	check_multicurrency,
	create_notification_log,
	create_user,
	get_average_rating,
	get_batch_details,
	get_batch_details_for_notification,
	get_categorized_courses,
	get_chapters,
	get_chart_data,
	get_chart_date_range,
	get_chart_details,
	get_chart_filters,
	get_completed_lessons,
	get_course_card_details,
	get_course_completion_data,
	get_course_content_stats,
	get_course_details,
	get_course_details_for_notification,
	get_course_or_filters,
	get_course_outline,
	get_course_progress,
	get_courses,
	get_courses_under_review,
	get_current_exchange_rate,
	get_enrollment_details,
	get_evaluator,
	get_featured_courses,
	get_instructors,
	get_lesson_count,
	get_lesson_icon,
	get_lesson_index,
	get_lesson_url,
	get_lessons,
	get_lms_route,
	get_membership,
	get_outline_chapter,
	get_outline_lessons,
	get_progress,
	get_reviews,
	get_scorm_files,
	guest_access_allowed,
	handle_notifications,
	has_course_instructor_role,
	has_evaluator_role,
	has_moderator_role,
	has_student_role,
	is_instructor,
	notify_mentions_on_portal,
	notify_mentions_via_email,
	slugify,
	sanitize_json,
	extend_bootinfo,
	persona_captured,
	publish_notifications,
	update_course_filters,
	update_payment_record,
	update_payment_details,
	update_coupon_redemption,
	update_certificate_purchase,
	validate_image,
	get_related_courses,
	get_programs,
	get_batches,
	get_batch_type,
	get_batch_card_details,
	get_program_details,
	get_payment_id,
	get_payment_doc,
	get_payment_details,
	get_paid_batch_details,
	get_lesson_creation_details,
	get_integration_requests,
	get_gst_details,
	get_palette,
	get_lesson,
	get_video_details,
	get_neighbour_lesson,
	categorize_batches,
	get_country_code,
	get_quiz_with_questions,
	get_batch_courses,
	get_assessments,
	get_assignment_details,
	get_quiz_details,
	get_exercise_details,
	get_batch_student_progress,
	get_course_completion_stats,
	get_assignment_pass_stats,
	get_quiz_pass_stats,
	get_batch_chart_data,
	get_batch_student_details,
	calculate_student_progress,
	calculate_course_progress,
	calculate_assessment_progress,
	has_submitted_assessment,
	get_assessment_meta,
	get_assessment_attempt_details,
	can_access_topic,
	get_discussion_topics,
	get_discussion_replies,
	get_order_summary,
	get_paid_course_details,
	apply_coupon,
	get_roles,
	is_demo_course,
	validate_course_access,
	get_field_meta,
	validate_batch_access,
	validate_program_enrollment,
	validate_discussion_reply,
	validate_coupon_applicability,
	validate_coupon,
	filter_batches_based_on_start_time,
	has_lms_role,
	enroll_in_program,
	enroll_in_course,
	enroll_in_batch,
	create_enrollment,
	complete_enrollment,
	create_discussion_topic,
	calculate_discount_amount,
	adjust_amount_for_coupon
)


class TestLMSUtils(BaseTestUtils):
	def setUp(self):
		super().setUp()

		self._setup_course_flow()
		self._setup_batch_flow()

		# Configuración base de settings simulados
		self.settings = MagicMock()
		self.settings.show_usd_equivalent = True
		self.settings.exception_country = []
		self.settings.apply_rounding = False

	def test_simple_slugs(self):
		self.assertEqual(slugify("hello-world"), "hello-world")
		self.assertEqual(slugify("Hello World"), "hello-world")
		self.assertEqual(slugify("Hello, World!"), "hello-world")

	def test_duplicates_slugs(self):
		self.assertEqual(slugify("Hello World", ["hello-world"]), "hello-world-2")
		self.assertEqual(slugify("Hello World", ["hello-world", "hello-world-2"]), "hello-world-3")

	def test_get_membership(self):
		membership = get_membership(self.course.name, self.student1.email)
		self.assertIsNotNone(membership)
		self.assertEqual(membership.course, self.course.name)
		self.assertEqual(membership.member, self.student1.email)

	def test_get_chapters(self):
		chapters = get_chapters(self.course.name)
		self.assertEqual(len(chapters), len(self.course.chapters))

		for i, chapter in enumerate(chapters, start=1):
			self.assertEqual(chapter.title, f"Chapter {i}")

	def test_get_lessons(self):
		lessons = get_lessons(self.course.name)
		all_lessons = frappe.db.count("Course Lesson", {"course": self.course.name})
		self.assertEqual(len(lessons), all_lessons)

	def test_get_instructors(self):
		instructors = get_instructors("LMS Course", self.course.name)
		self.assertEqual(len(instructors), len(self.course.instructors))
		self.assertEqual(instructors[0].name, "frappe@example.com")

	def test_get_average_rating(self):
		average_rating = get_average_rating(self.course.name)
		self.assertEqual(average_rating, 4.5)

	def test_get_reviews(self):
		reviews = get_reviews(self.course.name)
		self.assertEqual(len(reviews), 2)

	def test_get_lesson_index(self):
		lessons = get_lessons(self.course.name)
		for lesson in lessons:
			self.assertEqual(get_lesson_index(lesson.name), lesson.number)

	def test_get_lesson_url(self):
		lessons = get_lessons(self.course.name)
		for lesson in lessons:
			expected_url = get_lms_route(f"courses/{self.course.name}/learn/{lesson.number}")
			self.assertEqual(get_lesson_url(self.course.name, lesson.number), expected_url)

	def test_is_instructor(self):
		frappe.session.user = "frappe@example.com"
		self.assertTrue(is_instructor(self.course.name))
		frappe.session.user = "Administrator"
		self.assertFalse(is_instructor(self.course.name))

	def test_has_course_instructor_role(self):
		self.assertIsNotNone(has_course_instructor_role("frappe@example.com"))
		self.assertIsNone(has_course_instructor_role("student1@example.com"))

	def test_has_moderator_role(self):
		self.assertIsNotNone(has_moderator_role("frappe@example.com"))
		self.assertIsNone(has_moderator_role("student2@example.com"))

	def test_has_evaluator_role(self):
		self.assertIsNotNone(has_evaluator_role("frappe@example.com"))
		self.assertIsNone(has_evaluator_role("student2@example.com"))

	def test_has_student_role(self):
		self.assertIsNotNone(has_student_role("student1@example.com"))
		self.assertIsNotNone(has_student_role("student2@example.com"))

	def test_is_certified(self):
		frappe.session.user = self.student1.email
		self.assertIsNotNone(is_certified(self.course.name))
		frappe.session.user = self.student2.email
		self.assertIsNone(is_certified(self.course.name))
		frappe.session.user = "Administrator"

	def test_rating_validation(self):
		student3 = self._create_user("student3@example.com", "Emily", "Cooper", ["LMS Student"])
		with self.assertRaises(frappe.exceptions.ValidationError):
			frappe.session.user = student3.email
			review = frappe.new_doc("LMS Course Review")
			review.course = self.course.name
			review.rating = -0.5
			review.review = "Bad course"
			review.save()
		frappe.session.user = "Administrator"

	def test_get_evaluator(self):
		evaluator_email = get_evaluator(self.course.name, self.batch.name)
		self.assertEqual(evaluator_email, self.evaluator.evaluator)

	def test_get_course_details(self):
		course_details = get_course_details(self.course.name)
		self.assertEqual(course_details.name, self.course.name)
		self.assertEqual(course_details.title, self.course.title)
		self.assertEqual(course_details.category, self.course.category)
		self.assertEqual(course_details.description, self.course.description)
		self.assertEqual(course_details.short_introduction, self.course.short_introduction)
		self.assertEqual(course_details.tags, self.course.tags)
		self.assertEqual(course_details.published, 1)
		self.assertEqual(len(course_details.instructors), len(self.course.instructors))

	def test_get_batch_details(self):
		batch_details = get_batch_details(self.batch.name)
		self.assertEqual(batch_details.name, self.batch.name)
		self.assertEqual(batch_details.title, self.batch.title)
		self.assertEqual(batch_details.start_date, getdate(self.batch.start_date))
		self.assertEqual(batch_details.end_date, getdate(self.batch.end_date))
		self.assertEqual(batch_details.start_time, to_timedelta(self.batch.start_time))
		self.assertEqual(batch_details.end_time, to_timedelta(self.batch.end_time))
		self.assertEqual(batch_details.timezone, self.batch.timezone)
		self.assertEqual(batch_details.published, 1)
		self.assertEqual(batch_details.description, self.batch.description)
		self.assertEqual(batch_details.batch_details, self.batch.batch_details)
		self.assertEqual(len(batch_details.courses), len(self.batch.courses))
		self.assertEqual(batch_details.evaluation_end_date, getdate(self.batch.evaluation_end_date))
		self.assertEqual(len(batch_details.instructors), len(self.batch.instructors))
		self.assertEqual(len(batch_details.students), 2)

	def test_create_user(self):
		user = create_user(
			email="testuser@example.com", first_name="Test", last_name="User", roles=["LMS Student"]
		)
		self.assertEqual(user.email, "testuser@example.com")
		self.assertEqual(user.first_name, "Test")
		self.assertEqual(user.last_name, "User")
		self.assertEqual(user.full_name, "Test User")
		self.assertIn("LMS Student", [role.role for role in user.roles])
		self.cleanup_items.append(("User", user.name))

	def test_create_user_with_full_name(self):
		user = create_user(
			email="fullnameuser@example.com", full_name="John Michael Doe", roles=["Course Creator"]
		)
		self.assertEqual(user.first_name, "John")
		self.assertEqual(user.last_name, "Michael Doe")
		self.assertEqual(user.full_name, "John Michael Doe")
		self.assertIn("Course Creator", [role.role for role in user.roles])
		self.cleanup_items.append(("User", user.name))

class TestUtils(BaseTestUtils):
	def setUp(self):
		super().setUp()

		self.settings = MagicMock()
		self.settings.show_usd_equivalent = True
		self.settings.exception_country = []
		self.settings.apply_rounding = False

	# UT-UTILS-001
	def test_get_lms_route_without_path(self):
		""" Verifica que la ruta predeterminada de LMS sea '/lms'. """
		route = get_lms_route()
		self.assertEqual(route, "/lms")

	# UT-UTILS-002
	def test_get_bootinfo_extension(self):
		""" Comprueba que la información de arranque incluya la ruta de LMS como cadena. """
		bootinf = {}
		extend_bootinfo(bootinf)
		self.assertIn("lms_path", bootinf)
		self.assertIsInstance(bootinf["lms_path"], str) 

	# UT-UTILS-003
	def test_create_user_without_roles(self):
		""" Valida la creación de un usuario con detalles básicos y asignación del rol 'LMS Student'. """
		user = create_user(
			email="alex@example.com", first_name="Alexander", last_name="Villa"
		)
		self.assertEqual(user.email, "alex@example.com")
		self.assertEqual(user.first_name, "Alexander")
		self.assertEqual(user.last_name, "Villa")
		self.assertEqual(user.full_name, "Alexander Villa")
		self.assertIn("LMS Student", [role.role for role in user.roles])
		self.cleanup_items.append(("User", user.name))

	# UT-UTILS-004
	def test_create_user_already_exists(self):
		""" Verifica que al intentar crear un usuario con un correo existente, se retorne el usuario previo en lugar de duplicarlo. """
		user = create_user(
			email="alex@example.com", first_name="Alexander", last_name="Villa", roles=["LMS Student"]
		)

		new_user = create_user(
			email="alex@example.com", first_name="Juanito", last_name="Maza", roles=["LMS Student"]
		)
		self.assertEqual(new_user.name, user.name)
		self.assertEqual(new_user.first_name, user.first_name)
		self.assertEqual(new_user.last_name, user.last_name)
		self.assertEqual(new_user.full_name, user.full_name)
		self.cleanup_items.append(("User", user.name))

	# UT-UTILS-005
	def test_get_chapters_without_course_name(self):
		""" Comprueba que se retorne una lista vacía al solicitar capítulos sin proporcionar el nombre del curso. """
		chapters = get_chapters("")
		self.assertEqual(chapters, [])

	# UT-UTILS-006
	def test_get_lessons_of_single_course(self):
		""" Valida que se obtengan las lecciones correspondientes a un capítulo específico de un curso. """
		fake_chapter = _dict({"name": "ch1"})
		fake_lessons = [
			_dict({"name": "l1", "chapter": "ch1"}),
			_dict({"name": "l2", "chapter": "ch1"}),
		]

		with patch("lms.lms.utils.get_lesson_details", return_value=fake_lessons):
			lessons = get_lessons("curso_mock", fake_chapter)

			self.assertGreater(len(lessons), 0)
			self.assertEqual(lessons[0].chapter, fake_chapter.name)

	# UT-UTILS-007
	def test_get_lessons_of_single_course_with_progress(self):
		""" Verifica que al solicitar lecciones con progreso, cada una incluya el atributo de completado. """
		fake_chapter = _dict({"name": "ch1"})
		fake_lessons = [
			_dict({"name": "l1", "chapter": "ch1", "is_complete": True}),
			_dict({"name": "l2", "chapter": "ch1", "is_complete": False}),
		]

		with patch("lms.lms.utils.get_lesson_details", return_value=fake_lessons):
			lessons = get_lessons("curso_mock", fake_chapter, progress=True)

			self.assertGreater(len(lessons), 0)
			for lesson in lessons:
				self.assertTrue(hasattr(lesson, "is_complete"))

	# UT-UTILS-008
	def test_icon_youtube_from_upload(self):
		""" Comprueba que un bloque de subida tipo mp4 asigne el ícono de YouTube a la lección. """
		content = json.dumps({
			"time" : 1765194986690,
			"blocks": [
				{"id": "dkLzbW14ds", "type": "upload", "data": {"file_type": "mp4"}}
			]
		})
		icon = get_lesson_icon("", content)
		self.assertEqual(icon, "icon-youtube")

	# UT-UTILS-009
	def test_icon_youtube_from_embed(self):
		""" Verifica que un bloque embebido de YouTube asigne el ícono de YouTube a la lección. """
		content = json.dumps({
			"time": 1765194986690,
			"blocks": [
				{"id": "dkLzbW14ds", "type": "embed", "data": {"service": "youtube"}}
			]
		})
		icon = get_lesson_icon("", content)
		self.assertEqual(icon, "icon-youtube")

	# UT-UTILS-010
	def test_icon_youtube_from_macro(self):
		""" Valida que la macro de YouTubeVideo asigne el ícono correspondiente. """
		body = "{{ YouTubeVideo(abc123) }}"
		icon = get_lesson_icon(body, None)
		self.assertEqual(icon, "icon-youtube")

	# UT-UTILS-011
	def test_icon_quiz_from_macro(self):
		""" Comprueba que la macro de Quiz asigne el ícono de cuestionario. """
		body = "{{ Quiz(quiz_id) }}"
		icon = get_lesson_icon(body, None)
		self.assertEqual(icon, "icon-quiz")

	# UT-UTILS-012
	def test_icon_list_default_macro(self):
		""" Verifica que cualquier otra macro asigne el ícono de lista por defecto. """
		body = "{{ Exercise(two-circles) }}"
		icon = get_lesson_icon(body, None)
		self.assertEqual(icon, "icon-list")

	# UT-UTILS-013
	def test_get_lesson_index_no_lesson_reference(self):
		""" Valida que retorne '1-1' como índice predeterminado si no existe referencia de la lección en DB. """
		with patch("frappe.db.get_value") as mock_get_value:
			mock_get_value.return_value = None
			result = get_lesson_index("lesson_inexistente")
			self.assertEqual(result, "1-1")

	# UT-UTILS-014
	def test_get_lesson_index_no_chapter_reference(self):
		""" Comprueba que retorne '1-1' si existe la lección pero no su capítulo padre. """
		with patch("frappe.db.get_value") as mock_get_value:
			mock_get_value.side_effect = [
				_dict({"idx": 2, "parent": "capitulo_falso"}),
				None
			]
			result = get_lesson_index("lesson_sin_capitulo")
			self.assertEqual(result, "1-1")

	# UT-UTILS-015
	def test_get_lesson_url_none_number(self):
		""" Verifica que retorne None si el lesson_number proporcionado es nulo. """
		""" lesson_number = None, debe devolver None """
		result = get_lesson_url("mi_curso", None)
		self.assertIsNone(result)

	# UT-UTILS-016
	def test_get_progress_without_member(self):
		""" Comprueba la obtención de progreso usando el usuario de sesión al no pasar miembro. """
		"""Simula que no se pasa member, por lo que se toma el usuario de sesión"""
		with patch("frappe.session") as mock_session, patch("frappe.db.exists") as mock_exists:
			mock_session.user = "usuario_sesion"
			mock_exists.return_value = True

			result = get_progress("curso python", "leccion 1")
			self.assertTrue(result)

			mock_exists.assert_called_once_with(
				"LMS Course Progress",
				{"course": "curso python", "member": "usuario_sesion", "lesson": "leccion 1", "status": "Complete"},
				["status"],
			)

	# UT-UTILS-017
	def test_get_progress_with_member(self):
		""" Valida la consulta de progreso especificando explícitamente un usuario por parámetro. """
		with patch("frappe.session") as mock_session, patch("frappe.db.exists") as mock_exists:
			mock_session.user = "usuario_sesion"
			# Simula que se pasa member explícito
			mock_exists.return_value = None  # No existe progreso

			result = get_progress("curso python", "leccion 1", member="otro_usuario")
			self.assertIsNone(result)

			mock_exists.assert_called_once_with(
				"LMS Course Progress",
				{"course": "curso python", "member": "otro_usuario", "lesson": "leccion 1", "status": "Complete"},
				["status"],
			)

	# UT-UTILS-018
	def test_get_course_progress_no_lessons(self):
		""" Verifica que un curso sin lecciones retorne un progreso del 0%. """
		# el curso no tiene lecciones → debe devolver 0
		with patch("lms.lms.utils.get_lesson_count") as mock_count:
			mock_count.return_value = 0

			result = get_course_progress("curso java", member="student@example.com")
			self.assertEqual(result, 0)

			mock_count.assert_called_once_with("curso java")

	# UT-UTILS-019
	def test_get_courses_under_review(self):
		""" Comprueba la obtención correcta del listado de cursos cuyo estado es 'Under Review'. """
		fake_courses = [
			{
				"name": "curso1",
				"upcoming": 0,
				"title": "Curso de Prueba",
				"short_introduction": "Intro corta",
				"image": "img.png",
				"paid_course": 0,
				"course_price": 0,
				"currency": "USD",
				"status": "Under Review",
				"published": 0,
			},
			{
				"name": "curso2",
				"upcoming": 1,
				"title": "Otro Curso",
				"short_introduction": "Otra intro",
				"image": "img2.png",
				"paid_course": 1,
				"course_price": 100,
				"currency": "USD",
				"status": "Under Review",
				"published": 1,
			},
		]

		with patch("frappe.get_all") as mock_get_all:
			mock_get_all.return_value = fake_courses

			result = get_courses_under_review()
			self.assertEqual(result, fake_courses)

	# UT-UTILS-020
	def test_validate_image_private_path(self):
		""" Valida que las rutas privadas de imágenes se transformen en públicas en la BD. """
		path = "/files/private/test.png"
		with patch("frappe.db.set_value") as mock_set_value:
			result = validate_image(path)

			# Debe devolver el path sin "/private"
			self.assertEqual(result, "/files/test.png")

			# Debe haber llamado a frappe.db.set_value con los parámetros correctos
			mock_set_value.assert_called_once_with(
				"File",
				{"file_url": path},
				"is_private",
				0,
			)

	# UT-UTILS-021
	def test_handle_notifications_invalid_doctype(self):
		""" Verifica que no se disparen notificaciones si el tipo de documento de referencia es inválido. """
		doc = _dict({"topic": "topic1"})
		fake_topic = _dict({
			"reference_doctype": "Otro Doctype",
			"reference_docname": "doc1",
			"owner": "juan",
			"title": "Titulo"
		})

		with patch("frappe.db.get_value") as mock_get_value, \
				patch("lms.lms.utils.create_notification_log") as mock_create, \
				patch("lms.lms.utils.notify_mentions_on_portal") as mock_portal, \
				patch("lms.lms.utils.notify_mentions_via_email") as mock_email:

			mock_get_value.return_value = fake_topic

			result = handle_notifications(doc, "")
			self.assertIsNone(result)

			# Verifica que no se llamaron las funciones de notificación
			mock_create.assert_not_called()
			mock_portal.assert_not_called()
			mock_email.assert_not_called()

	# UT-UTILS-022
	def test_handle_notifications_valid_doctype(self):
		""" Comprueba que se ejecuten correctamente todos los métodos de notificación para documentos válidos. """
		doc = _dict({"topic": "topic2"})
		fake_topic = _dict({
			"reference_doctype": "Course Lesson",
			"reference_docname": "doc2",
			"owner": "pepito",
			"title": "Titulo"
		})

		with patch("frappe.db.get_value") as mock_get_value, \
				patch("lms.lms.utils.create_notification_log") as mock_create, \
				patch("lms.lms.utils.notify_mentions_on_portal") as mock_portal, \
				patch("lms.lms.utils.notify_mentions_via_email") as mock_email:

			mock_get_value.return_value = fake_topic

			handle_notifications(doc, "")

			# Verifica que sí se llamaron las funciones de notificación
			mock_create.assert_called_once_with(doc, fake_topic)
			mock_portal.assert_called_once_with(doc, fake_topic)
			mock_email.assert_called_once_with(doc, fake_topic)

	# UT-UTILS-023
	def test_get_course_details_for_notification(self):
		""" Valida la construcción del asunto, enlace y destinatarios (dueño e instructores) de un curso. """
		topic = _dict({
			"reference_docname": "lesson1",
			"owner": "pepito@example.com",
			"title": "Tema de prueba"
		})

		with patch("frappe.db.get_value") as mock_get_value, \
				patch("frappe.db.get_all") as mock_get_all, \
				patch("lms.lms.utils.get_lesson_url") as mock_get_lesson_url, \
				patch("lms.lms.utils.get_lesson_index") as mock_get_lesson_index:

			# Simula valores de la BD
			mock_get_value.side_effect = [
				"curso_demo",   # course desde Course Lesson
				"Curso Demo"    # title desde LMS Course
			]
			mock_get_all.return_value = ["instructor1@example.com", "instructor2@example.com"]

			# Simula funciones auxiliares
			mock_get_lesson_index.return_value = "1-1"
			mock_get_lesson_url.return_value = "/courses/curso_demo/learn/1-1"

			subject, link, users = get_course_details_for_notification(topic)

			# Verifica subject
			self.assertIn("Tema de prueba", subject)
			self.assertIn("Curso Demo", subject)

			# Verifica link
			self.assertEqual(link, "/courses/curso_demo/learn/1-1")

			# Verifica usuarios: owner + instructores
			self.assertIn("pepito@example.com", users)
			self.assertIn("instructor1@example.com", users)
			self.assertIn("instructor2@example.com", users)

			mock_get_value.assert_any_call("Course Lesson", "lesson1", "course")
			mock_get_value.assert_any_call("LMS Course", "curso_demo", "title")
			mock_get_lesson_index.assert_called_once_with("lesson1")
			mock_get_lesson_url.assert_called_once_with("curso_demo", "1-1")

	# UT-UTILS-024
	def test_get_batch_details_for_notification(self):
		""" Comprueba la construcción de detalles de notificación para un lote (instructores y estudiantes). """
		topic = _dict({
			"reference_docname": "batch1",
			"owner": "pepito@example.com",
			"title": "Batch de prueba"
		})

		with patch("frappe.db.get_value") as mock_get_value, \
				patch("frappe.db.get_all") as mock_get_all, \
				patch("lms.lms.utils.get_lms_route") as mock_get_lms_route:

			mock_get_value.return_value = "Batch Demo"
			mock_get_all.side_effect = [
				["instructor1@example.com", "instructor2@example.com"],  # instructores
				["student1@example.com", "student2@example.com"]         # estudiantes
			]

			mock_get_lms_route.return_value = "/batches/batch1#discussions"

			subject, link, users = get_batch_details_for_notification(topic)

			# Verifica subject
			self.assertIn("Batch Demo", subject)

			# Verifica link
			self.assertEqual(link, "/batches/batch1#discussions")

			# Verifica usuarios: instructores + estudiantes
			self.assertIn("instructor1@example.com", users)
			self.assertIn("instructor2@example.com", users)
			self.assertIn("student1@example.com", users)
			self.assertIn("student2@example.com", users)

			# Verifica llamadas
			mock_get_value.assert_called_once_with("LMS Batch", "batch1", "title")
			mock_get_all.assert_any_call(
				"LMS Batch Enrollment",
				{"batch": "batch1"},
				pluck="member"
			)
			mock_get_lms_route.assert_called_once_with("batches/batch1#discussions")

	# UT-UTILS-025
	def test_create_notification_log_course_lesson_owner_removed(self):
		""" Verifica la creación de logs asegurando que el creador de la acción se excluya de la alerta. """
		doc = _dict({"owner": "owner@example.com", "reply": "Respuesta"})
		topic = _dict({"reference_doctype": "Course Lesson", "reference_docname": "lesson1"})

		with patch("lms.lms.utils.get_course_details_for_notification") as mock_course_details, \
				patch("lms.lms.utils.make_notification_logs") as mock_make_logs:

			# Simula que devuelve subject, link y users incluyendo al owner
			mock_course_details.return_value = (
				"Subject Demo",
				"/courses/demo/learn/1-1",
				["owner@example.com", "user2@example.com"]
			)

			create_notification_log(doc, topic)

			# Verifica que el owner fue removido
			args, kwargs = mock_make_logs.call_args
			notification, users = args
			self.assertNotIn("owner@example.com", users)
			self.assertIn("user2@example.com", users)

			# Verifica que el notification dict se construyó correctamente
			self.assertEqual(notification["subject"], "Subject Demo")
			self.assertEqual(notification["email_content"], "Respuesta")
			self.assertEqual(notification["document_type"], "Course Lesson")
			self.assertEqual(notification["document_name"], "lesson1")
			self.assertEqual(notification["from_user"], "owner@example.com")
			self.assertEqual(notification["type"], "Alert")
			self.assertEqual(notification["link"], "/courses/demo/learn/1-1")

	# UT-UTILS-026
	def test_create_notification_log_batch_doctype(self):
		""" Valida la creación de alertas para lotes, verificando el paso correcto de destinatarios. """
		doc = _dict({"owner": "owner@example.com", "reply": "Otra respuesta"})
		topic = _dict({"reference_doctype": "LMS Batch", "reference_docname": "batch1"})

		with patch("lms.lms.utils.get_batch_details_for_notification") as mock_batch_details, \
				patch("lms.lms.utils.make_notification_logs") as mock_make_logs:

			# Simula que devuelve subject, link y users sin incluir al owner
			mock_batch_details.return_value = (
				"Batch Subject",
				"/batches/batch1#discussions",
				["userA@example.com", "userB@example.com"]
			)

			create_notification_log(doc, topic)

			# Verifica que los usuarios se pasaron tal cual (owner no estaba)
			args, kwargs = mock_make_logs.call_args
			notification, users = args
			self.assertIn("userA@example.com", users)
			self.assertIn("userB@example.com", users)

			# Verifica que el notification dict se construyó correctamente
			self.assertEqual(notification["subject"], "Batch Subject")
			self.assertEqual(notification["email_content"], "Otra respuesta")
			self.assertEqual(notification["document_type"], "LMS Batch")
			self.assertEqual(notification["document_name"], "batch1")
			self.assertEqual(notification["from_user"], "owner@example.com")
			self.assertEqual(notification["type"], "Alert")
			self.assertEqual(notification["link"], "/batches/batch1#discussions")

	# UT-UTILS-027
	def test_notify_mentions_no_mentions(self):
		""" Verifica que no se generen notificaciones si la respuesta no contiene menciones. """
		doc = _dict({"reply": "sin @menciones", "owner": "owner@example.com"})
		topic = _dict({"reference_doctype": "Course Lesson", "reference_docname": "lesson1", "title": "Titulo"})

		with patch("lms.lms.utils.extract_mentions") as mock_extract, \
				patch("lms.lms.utils.make_notification_logs") as mock_make_logs:
			mock_extract.return_value = []  # no menciones

			result = notify_mentions_on_portal(doc, topic)
			self.assertIsNone(result)

			mock_make_logs.assert_not_called()

	# UT-UTILS-028
	def test_notify_mentions_course_lesson(self):
		""" Valida la creación del log de notificaciones para menciones dentro de una lección de curso. """
		doc = _dict({"reply": "@user1 Hola!", "owner": "owner@example.com"})
		topic = _dict({"reference_doctype": "Course Lesson", "reference_docname": "lesson1", "title": "Titulo Curso"})

		with patch("lms.lms.utils.extract_mentions") as mock_extract, \
				patch("lms.lms.utils.get_fullname") as mock_fullname, \
				patch("frappe.db.get_value") as mock_get_value, \
				patch("lms.lms.utils.get_lesson_index") as mock_index, \
				patch("lms.lms.utils.get_lesson_url") as mock_url, \
				patch("lms.lms.utils.make_notification_logs") as mock_make_logs:

			mock_extract.return_value = ["user1@example.com"]
			mock_fullname.return_value = "Owner Name"
			mock_get_value.return_value = "curso_demo"
			mock_index.return_value = "1-1"
			mock_url.return_value = "/courses/curso_demo/learn/1-1"

			notify_mentions_on_portal(doc, topic)

			# Verifica que se construyó el subject y se llamó a make_notification_logs
			args, kwargs = mock_make_logs.call_args
			notification, user = args
			self.assertEqual(user, "user1@example.com")
			self.assertEqual(notification["document_type"], "Course Lesson")
			self.assertEqual(notification["document_name"], "lesson1")
			self.assertEqual(notification["from_user"], "owner@example.com")
			self.assertEqual(notification["type"], "Mention")
			self.assertEqual(notification["link"], "/courses/curso_demo/learn/1-1")

	# UT-UTILS-029
	def test_notify_mentions_batch(self):
		""" Comprueba que se registre correctamente una mención realizada en las discusiones de un batch. """
		doc = _dict({"reply": "@user2 Hola!", "owner": "owner@example.com"})
		topic = _dict({"reference_doctype": "LMS Batch", "reference_docname": "batch1", "title": "Batch Demo"})

		with patch("lms.lms.utils.extract_mentions") as mock_extract, \
				patch("lms.lms.utils.get_fullname") as mock_fullname, \
				patch("frappe.db.get_value") as mock_get_value, \
				patch("lms.lms.utils.get_lms_route") as mock_route, \
				patch("lms.lms.utils.make_notification_logs") as mock_make_logs:

			mock_extract.return_value = ["user2@example.com"]
			mock_fullname.return_value = "Owner Name"
			mock_get_value.return_value = "Batch Title"
			mock_route.return_value = "/batches/batch1#discussions"

			notify_mentions_on_portal(doc, topic)

			args, kwargs = mock_make_logs.call_args
			notification, user = args
			self.assertEqual(user, "user2@example.com")
			self.assertEqual(notification["document_type"], "LMS Batch")
			self.assertEqual(notification["document_name"], "batch1")
			self.assertEqual(notification["from_user"], "owner@example.com")
			self.assertEqual(notification["type"], "Mention")
			self.assertEqual(notification["link"], "/batches/batch1#discussions")

	# UT-UTILS-030
	def test_notify_mentions_via_email_no_mentions(self):
		""" Evita la ejecución del envío de correo si el parser no detecta cuentas válidas mencionadas. """
		doc = _dict({"reply": "@user Hola!", "owner": "owner@example.com"})
		topic = _dict({"reference_docname": "lesson1", "reference_doctype": "Course Lesson"})

		with patch("frappe.get_cached_value") as mock_cached, \
				patch("frappe.conf", {"mail_login": "login"}), \
				patch("lms.lms.utils.extract_mentions") as mock_extract, \
				patch("frappe.sendmail") as mock_sendmail:

			mock_cached.return_value = "ongoing_account" 
			mock_extract.return_value = []  # no menciones

			result = notify_mentions_via_email(doc, topic)
			self.assertIsNone(result)

			mock_sendmail.assert_not_called()

	# UT-UTILS-031
	def test_notify_mentions_via_email_no_outgoing_account(self):
		""" Verifica que no se procese el envío si el sistema carece de configuración de cuenta de correo saliente. """
		doc = _dict({"reply": "@user Hola!", "owner": "owner@example.com"})
		topic = _dict({"reference_docname": "lesson1", "reference_doctype": "Course Lesson"})

		with patch("frappe.get_cached_value") as mock_cached, \
				patch("frappe.conf", {"mail_login": None}), \
				patch("lms.lms.utils.extract_mentions") as mock_extract, \
				patch("frappe.sendmail") as mock_sendmail:
			
			mock_cached.return_value = None  # no cuenta de correo
			mock_extract.return_value = []

			result = notify_mentions_via_email(doc, topic)
			self.assertIsNone(result)
			mock_sendmail.assert_not_called()

	# UT-UTILS-032
	def test_notify_mentions_via_email_course_lesson(self):
		""" Valida la construcción y el envío del correo electrónico por mención en una lección. """
		doc = _dict({"reply": "@user Hola!", "owner": "owner@example.com"})
		topic = _dict({"reference_docname": "lesson1", "reference_doctype": "Course Lesson"})

		with patch("frappe.get_cached_value") as mock_cached, \
				patch("frappe.conf", {"mail_login": "login"}), \
				patch("lms.lms.utils.extract_mentions") as mock_extract, \
				patch("lms.lms.utils.get_fullname") as mock_fullname, \
				patch("frappe.db.get_value") as mock_get_value, \
				patch("lms.lms.utils.get_lesson_index") as mock_index, \
				patch("lms.lms.utils.get_lesson_url") as mock_url, \
				patch("frappe.sendmail") as mock_sendmail:

			mock_cached.return_value = "outgoing_account"
			mock_extract.return_value = ["user1"]
			mock_fullname.return_value = "Owner Name"
			# get_value se llama dos veces: primero para User.email, luego para Course Lesson.course
			mock_get_value.side_effect = ["user1@example.com", "curso_demo"]
			mock_index.return_value = "1-1"
			mock_url.return_value = "/courses/curso_demo/learn/1-1"

			notify_mentions_via_email(doc, topic)

			args, kwargs = mock_sendmail.call_args
			self.assertEqual(kwargs["recipients"], "user1@example.com")
			self.assertIn("Owner Name", kwargs["subject"])
			self.assertEqual(kwargs["template"], "mention_template")
			self.assertEqual(kwargs["args"]["link"], "/courses/curso_demo/learn/1-1")

	# UT-UTILS-033
	def test_notify_mentions_via_email_batch(self):
		""" Comprueba que la URL embebida en el correo de mención apunte correctamente al batch referenciado. """
		doc = _dict({"reply": "@user Hola!", "owner": "owner@example.com"})
		topic = _dict({"reference_docname": "batch1", "reference_doctype": "LMS Batch"})

		with patch("frappe.get_cached_value") as mock_cached, \
				patch("frappe.conf", {"mail_login": "login"}), \
				patch("lms.lms.utils.extract_mentions") as mock_extract, \
				patch("lms.lms.utils.get_fullname") as mock_fullname, \
				patch("frappe.db.get_value") as mock_get_value, \
				patch("frappe.sendmail") as mock_sendmail:

			mock_cached.return_value = "outgoing_account"
			mock_extract.return_value = ["user2"]
			mock_fullname.return_value = "Owner Name"
			# get_value se llama para User.email y para LMS Batch.title
			mock_get_value.side_effect = ["user2@example.com", "Batch Demo"]

			notify_mentions_via_email(doc, topic)

			args, kwargs = mock_sendmail.call_args
			self.assertEqual(kwargs["recipients"], "user2@example.com")
			self.assertIn("Owner Name", kwargs["subject"])
			self.assertEqual(kwargs["template"], "mention_template")
			self.assertEqual(kwargs["args"]["link"], "/batches/batch1#discussions")

	# UT-UTILS-034
	def test_get_lesson_count_no_chapters(self):
		""" Valida que el conteo regrese 0 e ignore la consulta SQL si el curso no cuenta con capítulos. """
		with patch("frappe.get_all") as mock_get_all, \
					patch("frappe.db.count") as mock_count:
			mock_get_all.return_value = []  # sin capítulos

			count = get_lesson_count("curso sin capitulos")
			self.assertEqual(count, 0)

			mock_count.assert_not_called()

	# UT-UTILS-035
	def test_get_chart_data_with_rows(self):
		""" Verifica que la estructura generada para gráficos albergue arreglos válidos con 'date' y 'count'. """
		with patch("lms.lms.utils.get_chart_date_range") as mock_range, \
				patch("frappe.get_doc") as mock_get_doc, \
				patch("lms.lms.utils.get_chart_details") as mock_details, \
				patch("lms.lms.utils.get_result") as mock_result:

			# Simula rango de fechas
			mock_range.return_value = ("2024-01-01", "2024-01-31")

			# Simula el chart doc
			chart_doc = _dict({
				"document_type": "Sales Invoice",
				"based_on": "posting_date",
				"value_based_on": "grand_total",
				"chart_type": "Line"
			})
			mock_get_doc.return_value = chart_doc

			# Simula detalles y resultado
			mock_details.return_value = "fake_data"
			mock_result.return_value = [
				("2024-01-01", 10),
				("2024-01-02", 20),
			]

			data = get_chart_data("chart_demo")

			self.assertEqual(len(data), 2)
			self.assertEqual(data[0]["date"], "2024-01-01")
			self.assertEqual(data[0]["count"], 10)
			self.assertEqual(data[1]["date"], "2024-01-02")
			self.assertEqual(data[1]["count"], 20)

	# UT-UTILS-036
	def test_get_chart_data_empty_result(self):
		""" Comprueba que devolver un arreglo vacío no detone excepciones al renderizar datos de gráfico. """
		with patch("lms.lms.utils.get_chart_date_range") as mock_range, \
				patch("frappe.get_doc") as mock_get_doc, \
				patch("lms.lms.utils.get_chart_details") as mock_details, \
				patch("lms.lms.utils.get_result") as mock_result:

			mock_range.return_value = ("2024-01-01", "2024-01-31")
			chart_doc = _dict({
				"document_type": "Sales Invoice",
				"based_on": "posting_date",
				"value_based_on": "grand_total",
				"chart_type": "Line"
			})
			mock_get_doc.return_value = chart_doc
			mock_details.return_value = "fake_data"
			mock_result.return_value = []  # sin filas

			data = get_chart_data("chart_demo")
			self.assertEqual(data, [])

	# UT-UTILS-037
	def test_get_chart_date_range_defaults(self):
		""" Asegura que al omitir parámetros de fecha, se asigne automáticamente un rango del último mes. """
		# Caso: no se pasan fechas → usa getdate() y add_months
		with patch("lms.lms.utils.getdate") as mock_getdate, \
				patch("lms.lms.utils.add_months") as mock_add_months, \
				patch("lms.lms.utils.get_datetime") as mock_get_datetime:

			# Simula fecha actual
			mock_getdate.return_value = datetime(2024, 2, 1)
			# Simula add_months → un mes antes
			mock_add_months.return_value = datetime(2024, 1, 1)
			# Simula get_datetime → devuelve mismo objeto
			mock_get_datetime.side_effect = lambda d: d

			from_date, to_date = get_chart_date_range(None, None)

			self.assertEqual(from_date, "2024-01-01")
			self.assertEqual(to_date, datetime(2024, 2, 1))

	# UT-UTILS-038
	def test_get_chart_date_range_with_params(self):
		""" Valida el parseo explícito de cadenas de texto a objetos `datetime` en límites del gráfico. """
		# Caso: se pasan fechas explícitas
		with patch("lms.lms.utils.get_datetime") as mock_get_datetime:
			mock_get_datetime.side_effect = lambda d: datetime.strptime(d, "%Y-%m-%d")

			from_date, to_date = get_chart_date_range("2024-03-01", "2024-03-31")

			self.assertEqual(from_date, "2024-03-01")
			self.assertEqual(to_date, datetime(2024, 3, 31))

	# UT-UTILS-039
	def test_get_chart_filters_version_15(self):
		""" Comprueba la inyección del parámetro 'False' en la matriz de filtros para compatibilidad de Frappe v15. """
		with patch("lms.lms.utils.get_frappe_version") as mock_version:
			chart = _dict({
				"document_type": "Sales Invoice",
				"filters_json": json.dumps([["Sales Invoice", "customer", "=", "Test Customer"]])
			})
			mock_version.return_value = "15.0.0"

			filters = get_chart_filters(
				"Sales Invoice",
				chart,
				"posting_date",
				"2024-01-01",
				"2024-01-31"
			)

			# Verifica que los filtros incluyan el parámetro False
			self.assertIn(["Sales Invoice", "docstatus", "<", 2, False], filters)
			self.assertIn(["Sales Invoice", "posting_date", ">=", "2024-01-01", False], filters)
			self.assertIn(["Sales Invoice", "posting_date", "<=", "2024-01-31", False], filters)

	# UT-UTILS-040
	def test_get_chart_filters_other_version(self):
		""" Verifica que la estructura de filtros asuma el estándar heredado para versiones inferiores de Frappe. """
		with patch("lms.lms.utils.get_frappe_version") as mock_version:
			chart = _dict({
				"document_type": "Sales Invoice",
				"filters_json": json.dumps([["Sales Invoice", "customer", "=", "Test Customer"]])
			})
			mock_version.return_value = "13.0.0"

			filters = get_chart_filters(
				"Sales Invoice",
				chart,
				"posting_date",
				"2024-01-01",
				"2024-01-31"
			)

			# Verifica que los filtros NO incluyan el parámetro False
			self.assertIn(["Sales Invoice", "docstatus", "<", 2], filters)
			self.assertIn(["Sales Invoice", "posting_date", ">=", "2024-01-01"], filters)
			self.assertIn(["Sales Invoice", "posting_date", "<=", "2024-01-31"], filters)

	# UT-UTILS-041
	def test_get_chart_details_version_15(self):
		""" Garantiza que los campos de agregación SQL se construyan como literales alias explícitos en Frappe v15. """
		with patch("lms.lms.utils.get_frappe_version") as mock_version, \
				patch("lms.lms.utils.get_chart_filters") as mock_filters, \
				patch("frappe.db.get_all") as mock_get_all:
			
			chart = _dict({
				"document_type": "Sales Invoice",
				"filters_json": "[]",
				"chart_type": "Line"
			})
			mock_version.return_value = "15.0.0"
			mock_filters.return_value = [["Sales Invoice", "docstatus", "<", 2, False]]
			mock_get_all.return_value = [("2024-01-01", 100, 2)]

			result = get_chart_details(
				"Sales Invoice", "posting_date", "grand_total",
				chart, "2024-01-01", "2024-01-31"
			)

			self.assertEqual(result, [("2024-01-01", 100, 2)])
			mock_get_all.assert_called_once_with(
				"Sales Invoice",
				fields=["posting_date as _unit", "SUM(grand_total)", "COUNT(*)"],
				filters=[["Sales Invoice", "docstatus", "<", 2, False]],
				group_by="_unit",
				order_by="_unit asc",
				as_list=True,
			)

	# UT-UTILS-042
	def test_get_chart_details_other_version(self):
		""" Garantiza que los campos de agregación mantengan el mapeo por diccionarios pre-v15. """
		with patch("lms.lms.utils.get_frappe_version") as mock_version, \
				patch("lms.lms.utils.get_chart_filters") as mock_filters, \
				patch("frappe.db.get_all") as mock_get_all:

			chart = _dict({
				"document_type": "Sales Invoice",
				"filters_json": "[]",
				"chart_type": "Line"
			})
						
			mock_version.return_value = "13.0.0"
			mock_filters.return_value = [["Sales Invoice", "docstatus", "<", 2]]
			mock_get_all.return_value = [("2024-01-01", 200, 5)]

			result = get_chart_details(
				"Sales Invoice", "posting_date", "grand_total",
				chart, "2024-01-01", "2024-01-31"
			)

			self.assertEqual(result, [("2024-01-01", 200, 5)])
			mock_get_all.assert_called_once_with(
				"Sales Invoice",
				fields=["posting_date", {"SUM": "grand_total"}, {"COUNT": "*"}],
				filters=[["Sales Invoice", "docstatus", "<", 2]],
				group_by="posting_date",
				order_by="posting_date",
				as_list=True,
			)

	# UT-UTILS-043
	def test_get_course_completion_data_with_completed(self):
		""" Comprueba que la proporción de completados vs progreso se determine a partir de la DB de inscripciones. """
		with patch("frappe.db.count") as mock_count:
			# Simula total de inscripciones y completadas
			mock_count.side_effect = [10, 4]  # all_membership=10, completed=4

			result = get_course_completion_data()

			self.assertEqual(result, [
				{"label": "Completed", "value": 4},
				{"label": "In Progress", "value": 6},
			])

			# Verifica que se llamó a frappe.db.count con los argumentos correctos
			mock_count.assert_any_call("LMS Enrollment")
			mock_count.assert_any_call("LMS Enrollment", {"progress": ["like", "%100%"]})

	# UT-UTILS-044
	def test_get_evaluator_without_batch(self):
		""" Valida que el evaluador resuelto al no declarar el lote provenga a nivel del Curso LMS. """
		with patch("frappe.db.get_value") as mock_get_value:
			mock_get_value.return_value = "evaluator@example.com"

			result = get_evaluator("curso_demo")

			# Verifica que devuelve el evaluator correcto
			self.assertEqual(result, "evaluator@example.com")

			# Verifica que se llamó con los parámetros esperados
			mock_get_value.assert_called_once_with("LMS Course", "curso_demo", "evaluator")

	# UT-UTILS-045
	def test_check_multicurrency_country_in_exception(self):
		""" Demuestra que se omite la evaluación de divisas si el país objetivo se ubica dentro de las excepciones. """
		self.settings.exception_country = [MagicMock(country="PE")]
		with patch("frappe.get_single", return_value=self.settings):
			result = check_multicurrency(100, "PEN", country="PE")
			self.assertEqual(result, (100, "PEN"))

	# UT-UTILS-046
	def test_check_multicurrency_conversion_disabled_or_currency_usd(self):
		""" Verifica que la deshabilitación del flag global o un monto ya en USD intercepte la conversión extra. """
		self.settings.show_usd_equivalent = False
		with patch("frappe.get_single", return_value=self.settings):
			result = check_multicurrency(50, "EUR", country="FR")
			self.assertEqual(result, (50, "EUR"))

		self.settings.show_usd_equivalent = True
		result = check_multicurrency(50, "USD", country="US")
		self.assertEqual(result, (50, "USD"))

	# UT-UTILS-047
	def test_check_multicurrency_explicit_amount_usd(self):
		""" Asegura que la presencia de un monto explícito en USD priorice dicho valor, esquivando el cálculo dinámico. """
		with patch("frappe.get_single", return_value=self.settings):
			result = check_multicurrency(200, "PEN", country="CL", amount_usd=50)
			self.assertEqual(result, (50, "USD"))

	# UT-UTILS-048
	def test_check_multicurrency_conversion_without_rounding(self):
		""" Ejecuta la operación de divisa reflejando el monto plano sin aplicar reajuste de precios redondeados. """
		with patch("frappe.get_single", return_value=self.settings), \
				patch("lms.lms.utils.get_current_exchange_rate", return_value=0.5), \
				patch("lms.lms.utils.flt", side_effect=lambda x, y: round(x, y)), \
				patch("lms.lms.utils.rounded", side_effect=lambda x: round(x, 2)):
			
			result = check_multicurrency(100, "EUR", country="FR")
			# 100 * 0.5 = 50.0
			self.assertEqual(result, (50.0, "USD"))

	# UT-UTILS-049
	def test_check_multicurrency_conversion_with_rounding(self):
		""" Comprueba el flujo cambiario que escala artificialmente el total hacia el centenar superior habilitado por settings. """
		self.settings.apply_rounding = True
		with patch("frappe.get_single", return_value=self.settings), \
				patch("lms.lms.utils.get_current_exchange_rate", return_value=1.23), \
				patch("lms.lms.utils.flt", side_effect=lambda x, y: round(x, y)), \
				patch("lms.lms.utils.rounded", side_effect=lambda x: round(x, 2)):
			
			result = check_multicurrency(80, "EUR", country="FR")
			# 80 * 1.23 = 98.4 → rounding to next hundred = 100
			self.assertEqual(result, (100, "USD"))

	# UT-UTILS-050
	def test_check_multicurrency_country_from_user(self):
		""" Determina la conversión recuperando la bandera del país asociada al usuario dentro de la base de datos local. """
		with patch("frappe.get_single", return_value=self.settings), \
			patch("frappe.db.get_value", side_effect=[None, "BR"]), \
			patch("lms.lms.utils.get_country_code", return_value=None):
			result = check_multicurrency(100, "EUR", country=None)
			self.assertIn(result[1], ["USD", "EUR"])

	# UT-UTILS-051
	def test_check_multicurrency_country_from_get_country_code(self):
		""" Respalda la ubicación extrayendo la región geolocalizada si la DB y parámetros fijos no asisten el contexto. """
		with patch("frappe.get_single", return_value=self.settings), \
			patch("frappe.db.get_value", side_effect=[None, None]), \
			patch("lms.lms.utils.get_country_code", return_value="AR"):
			result = check_multicurrency(100, "EUR", country=None)
			self.assertIn(result[1], ["USD", "EUR"])
		
	# UT-UTILS-052
	def test_apply_gst_disabled(self):
		""" Retiene el monto sin impuesto si la configuración de 'LMS Settings' niega la aplicación del GST. """
		with patch("frappe.db.get_single_value") as mock_single_value:
			mock_single_value.return_value = False  # apply_gst deshabilitado

			amount, gst = apply_gst(100, country="India")
			self.assertEqual(amount, 100)
			self.assertEqual(gst, 0)

			mock_single_value.assert_called_once_with("LMS Settings", "apply_gst")

	# UT-UTILS-053
	def test_apply_gst_enabled_india(self):
		""" Carga el impuesto fijo del 18% para el país habilitado explícitamente y entrega el subtotal con recargo. """
		with patch("frappe.db.get_single_value") as mock_single_value:
			mock_single_value.return_value = True  # apply_gst habilitado

			amount, gst = apply_gst(200, country="India")
			# GST = 200 * 0.18 = 36
			self.assertEqual(amount, 236)
			self.assertEqual(gst, 36)

	# UT-UTILS-054
	def test_apply_gst_enabled_non_india(self):
		""" Aborta la aplicación del porcentaje GST si, pese a estar en configuración, el país destino difiere de India. """
		with patch("frappe.db.get_single_value") as mock_single_value:
			mock_single_value.return_value = True  # apply_gst habilitado

			amount, gst = apply_gst(150, country="USA")
			self.assertEqual(amount, 150)
			self.assertEqual(gst, 0)

	# UT-UTILS-055
	def test_apply_gst_country_none_fetch_from_user(self):
		""" Computa el recargo fiscal evaluando un país nulo que luego se soluciona consultando la información del usuario en DB. """
		with patch("frappe.db.get_single_value") as mock_single_value, \
			patch("frappe.db.get_value", return_value="India"), \
			patch("frappe.session") as mock_session:
			
			mock_session.user = "user@example.com"
			mock_single_value.return_value = True  # apply_gst habilitado

			amount, gst = apply_gst(100, country=None)
			# GST = 100 * 0.18 = 18
			self.assertEqual(amount, 118)
			self.assertEqual(gst, 18)

			mock_single_value.assert_called_once_with("LMS Settings", "apply_gst")

	# UT-UTILS-056
	def test_exchange_rate_usd(self):
		""" Demuestra la obtención directa de la divisa contactando a la red externa vía request para el target prediseñado USD. """
		fake_response = MagicMock()
		fake_response.json.return_value = {"rates": {"USD": 1.25}}

		with patch("requests.request", return_value=fake_response) as mock_request:
			rate = get_current_exchange_rate("EUR")

			self.assertEqual(rate, 1.25)
			mock_request.assert_called_once_with("GET", "https://api.frankfurter.app/latest?from=EUR&to=USD")

	# UT-UTILS-057
	def test_exchange_rate_other_target(self):
		""" Asegura que el servicio cambie dinámicamente los parámetros GET de la URL al variar la divisa objetivo. """
		fake_response = MagicMock()
		fake_response.json.return_value = {"rates": {"GBP": 0.85}}

		with patch("requests.request", return_value=fake_response) as mock_request:
			rate = get_current_exchange_rate("USD", target="GBP")

			self.assertEqual(rate, 0.85)
			mock_request.assert_called_once_with("GET", "https://api.frankfurter.app/latest?from=USD&to=GBP")

	# UT-UTILS-058
	def test_guest_user_access_not_allowed(self):
		""" Verifica que el acceso de invitado no esté permitido si la configuración está deshabilitada. """
		with patch("frappe.get_cached_value") as mock_cached, \
				patch("frappe.session") as mock_session:
			mock_session.user = "Guest"
			mock_cached.return_value = False  # configuración deshabilitada

			result = guest_access_allowed()
			self.assertFalse(result)

	# UT-UTILS-059
	def test_guest_access_not_allowed(self):
		""" Verifica que get_courses retorne una lista vacía si el acceso de invitado no está permitido. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=False):
			result = get_courses()
			self.assertEqual(result, [])

	# UT-UTILS-060
	def test_get_courses_normal_flow(self):
		""" Valida el flujo normal de get_courses retornando los cursos disponibles. """
		fake_courses = [{"name": "curso1"}, {"name": "curso2"}]
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("lms.lms.utils.update_course_filters", return_value=({"f": "v"}, {}, False)), \
			patch("lms.lms.utils.get_course_fields", return_value=["name"]), \
			patch("frappe.get_all", return_value=fake_courses), \
			patch("lms.lms.utils.get_enrollment_details", return_value=fake_courses), \
			patch("lms.lms.utils.get_course_card_details", return_value=fake_courses):

			result = get_courses()
			self.assertEqual(result, fake_courses)

	# UT-UTILS-061
	def test_get_courses_with_featured(self):
		""" Comprueba que get_courses antepone los cursos destacados al principio de la lista. """
		fake_courses = [{"name": "curso1"}]
		fake_featured = [{"name": "destacado"}]
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("lms.lms.utils.update_course_filters", return_value=({"f": "v"}, {}, True)), \
			patch("lms.lms.utils.get_course_fields", return_value=["name"]), \
			patch("frappe.get_all", return_value=fake_courses), \
			patch("lms.lms.utils.get_featured_courses", return_value=fake_featured), \
			patch("lms.lms.utils.get_enrollment_details", return_value=fake_featured + fake_courses), \
			patch("lms.lms.utils.get_course_card_details", return_value=fake_featured + fake_courses):

			result = get_courses(start=0)
			# Verifica que los destacados se anteponen
			self.assertEqual(result[0]["name"], "destacado")
			self.assertEqual(result[1]["name"], "curso1")

	# UT-UTILS-062
	def test_course_free_or_unpublished(self):
		""" Verifica que un curso gratuito o no publicado no tenga atributos de precio. """
		courses = [_dict({"name": "curso1", "paid_course": False, "published": 0})]

		with patch("lms.lms.utils.get_instructors", return_value=["prof1"]) as mock_instructors:
			result = get_course_card_details(courses)

			self.assertEqual(result[0].instructors, ["prof1"])
			# No debe tener atributos de precio
			self.assertIsNone(result[0].get("price"))
			mock_instructors.assert_called_once_with("LMS Course", "curso1")

	# UT-UTILS-063
	def test_course_paid_and_published(self):
		""" Valida que un curso de pago publicado asigne correctamente la moneda y el monto formateado. """
		courses = [_dict({
			"name": "curso2",
			"paid_course": True,
			"published": 1,
			"course_price": 100,
			"currency": "EUR",
			"amount_usd": 80
		})]

		with patch("lms.lms.utils.get_instructors", return_value=["prof2"]), \
				patch("lms.lms.utils.check_multicurrency", return_value=(120, "USD")) as mock_multi, \
				patch("lms.lms.utils.fmt_money", return_value="$120") as mock_fmt:

			result = get_course_card_details(courses)

			self.assertEqual(result[0].instructors, ["prof2"])
			self.assertEqual(result[0].amount, 120)
			self.assertEqual(result[0].currency, "USD")
			self.assertEqual(result[0].price, "$120")

	# UT-UTILS-064
	def test_with_title_in_filters(self):
		""" Comprueba que al filtrar por título se generen los filtros esperados de título, introducción, descripción y etiquetas. """
		filters = {"title": "Python desde Cero"}
		result = get_course_or_filters(filters)

		expected = {
			"title": "Python desde Cero",
			"short_introduction": "Python desde Cero",
			"description": "Python desde Cero",
			"tags": "Python desde Cero",
		}
		self.assertEqual(result, expected)

	# UT-UTILS-065
	def test_update_course_filters_with_title(self):
		""" Verifica que update_course_filters separe correctamente el filtro de título a or_filters. """
		filters = {"title": "Python"}
		with patch("lms.lms.utils.get_course_or_filters", return_value={"title": "Python"}):
			new_filters, or_filters, show_featured = update_course_filters(filters)
			self.assertNotIn("title", new_filters)
			self.assertEqual(or_filters, {"title": "Python"})
			self.assertFalse(show_featured)

	# UT-UTILS-066
	def test_update_course_filters_with_enrolled(self):
		""" Valida que el filtro enrolled obtenga los cursos del usuario y actualice los filtros principales. """
		filters = {"enrolled": True}
		with patch("frappe.get_all", return_value=["curso1", "curso2"]), \
				patch("frappe.session") as mock_user:
			mock_user.user = "user@example.com"
			new_filters, or_filters, show_featured = update_course_filters(filters)
			self.assertNotIn("enrolled", new_filters)
			self.assertEqual(new_filters["name"], ["in", ["curso1", "curso2"]])
			self.assertEqual(or_filters, {})
			self.assertFalse(show_featured)

	# UT-UTILS-067
	def test_update_course_filters_with_created(self):
		""" Verifica que el filtro created limite los resultados a los cursos creados por el usuario en sesión. """
		filters = {"created": True}
		with patch("frappe.get_all", return_value=["cursoA", "cursoB"]), \
				patch("frappe.session") as mock_user:
			mock_user.user = "user@example.com"
			new_filters, or_filters, show_featured = update_course_filters(filters)
			self.assertNotIn("created", new_filters)
			self.assertEqual(new_filters["name"], ["in", ["cursoA", "cursoB"]])
			self.assertEqual(or_filters, {})
			self.assertFalse(show_featured)

	# UT-UTILS-068
	def test_update_course_filters_with_live(self):
		""" Comprueba que el filtro live establezca featured en 0 y active show_featured. """
		filters = {"live": True}
		new_filters, or_filters, show_featured = update_course_filters(filters)
		self.assertNotIn("live", new_filters)
		self.assertEqual(new_filters["featured"], 0)
		self.assertTrue(show_featured)
		self.assertEqual(or_filters, {})

	# UT-UTILS-069
	def test_update_course_filters_with_certification(self):
		""" Verifica que el filtro certification agregue condiciones de certificado habilitado y de pago. """
		filters = {"certification": True}
		new_filters, or_filters, show_featured = update_course_filters(filters)
		self.assertNotIn("certification", new_filters)
		self.assertEqual(or_filters, {"enable_certification": 1, "paid_certificate": 1})
		self.assertFalse(show_featured)

	# UT-UTILS-070
	def test_enrollment_details_course_with_enrollment(self):
		""" Valida que get_enrollment_details añada el atributo membership si el usuario está inscrito. """
		courses = [_dict({"name": "curso1"})]

		with patch("frappe.db.exists", return_value=True), \
				patch("frappe.db.get_value", return_value={"name": "enroll1", "course": "curso1"}), \
				patch("frappe.session") as mock_session:
				mock_session.user = "user@example.com"

				result = get_enrollment_details(courses)

				self.assertIn("membership", result[0])
				self.assertEqual(result[0].membership["course"], "curso1")

	# UT-UTILS-071
	def test_enrollment_details_course_without_enrollment(self):
		""" Verifica que no se añada membership si el usuario no tiene inscripción en el curso. """
		courses = [_dict({"name": "curso2"})]

		with patch("frappe.db.exists", return_value=False), \
			patch("frappe.session") as mock_session:
			mock_session.user = "user@example.com"

			result = get_enrollment_details(courses)

			# No debe tener atributo membership
			self.assertIsNone(result[0].get("membership"))

	# UT-UTILS-072
	def test_get_featured_courses(self):
		""" Comprueba que get_featured_courses agregue featured=1 a los filtros y retorne la lista correcta. """
		filters = {"category": "tech"}
		or_filters = {"title": "Python"}
		fields = ["name", "title"]

		fake_courses = [{"name": "curso1"}, {"name": "curso2"}]

		with patch("frappe.get_all", return_value=fake_courses):
			result = get_featured_courses(filters, or_filters, fields)

			# Verifica que devuelve la lista simulada
			self.assertEqual(result, fake_courses)

			# Verifica que se añadió featured=1 a los filtros
			self.assertEqual(filters["featured"], 1)

	# UT-UTILS-073
	def test_course_content_stats_when_content_none(self):
		""" Valida que las estadísticas del curso retornen 0 quizzes si el contenido de la lección es None. """
		with patch("lms.lms.utils.get_chapters") as mock_get_chapters, \
				patch("frappe.get_all") as mock_get_all, \
				patch("frappe.db.get_value", return_value=None):
			chapter = _dict({"name": "chapter1"})
			lesson_row = _dict({"lesson": "lesson1"})

			mock_get_chapters.return_value = [chapter]
			mock_get_all.return_value = [lesson_row]

			result = get_course_content_stats("curso_demo")
			self.assertEqual(result, {"quiz_count": 0})

	# UT-UTILS-074
	def test_course_content_stats_when_invalid_json(self):
		""" Verifica que retorne 0 quizzes si el contenido de la lección es un JSON inválido. """
		with patch("lms.lms.utils.get_chapters") as mock_get_chapters, \
				patch("frappe.get_all") as mock_get_all, \
				patch("frappe.db.get_value", return_value="no-es-json"):
			chapter = _dict({"name": "chapter1"})
			lesson_row = _dict({"lesson": "lesson1"})

			mock_get_chapters.return_value = [chapter]
			mock_get_all.return_value = [lesson_row]

			result = get_course_content_stats("curso_demo")
			self.assertEqual(result, {"quiz_count": 0})

	# UT-UTILS-075
	def test_course_details_guest_access_denied(self):
		""" Comprueba que get_course_details devuelva un diccionario vacío si el acceso de invitado está denegado. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=False):
			result = get_course_details("curso1")
			self.assertEqual(result, {})

	# UT-UTILS-076
	def test_course_details_course_not_published_no_access(self):
		""" Valida que devuelva vacío si el curso no está publicado, sin membresía ni permisos de modificación. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
				patch("frappe.db.get_value", return_value=0), \
				patch("lms.lms.utils.get_membership", return_value=None), \
				patch("lms.lms.utils.can_modify_course", return_value=False):
			result = get_course_details("curso2")
			self.assertEqual(result, {})

	# UT-UTILS-077
	def test_course_details_course_published_with_price(self):
		""" Verifica que devuelva los detalles correctos, incluyendo el precio formateado, instructores y estadísticas. """
		fake_course = _dict({
			"name": "curso3",
			"paid_course": True,
			"paid_certificate": False,
			"course_price": 100,
			"currency": "EUR",
		})
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
				patch("frappe.db.get_value", side_effect=[1, fake_course]), \
				patch("lms.lms.utils.get_membership", return_value=None), \
				patch("lms.lms.utils.can_modify_course", return_value=True), \
				patch("lms.lms.utils.get_course_fields", return_value=["name","course_price","currency"]), \
				patch("lms.lms.utils.get_instructors", return_value=["prof"]), \
				patch("frappe.db.count", return_value=5), \
				patch("lms.lms.utils.get_course_content_stats", return_value={"quiz_count": 2}), \
				patch("lms.lms.utils.fmt_money", return_value="$100"), \
				patch("frappe.session") as mock_user:
			mock_user.user = "user@example.com"

			result = get_course_details("curso3")
			self.assertEqual(result.price, "$100")
			self.assertEqual(result.instructors, ["prof"])
			self.assertEqual(result.rating_count, 5)
			self.assertEqual(result.quiz_count, 2)

	# UT-UTILS-078
	def test_course_details_course_guest_user_sets_instructor_false(self):
		""" Comprueba que para un usuario invitado, is_instructor se establezca explícitamente en False. """
		fake_course = _dict({
			"name": "curso4",
			"paid_course": False,
			"paid_certificate": False,
			"course_price": 50,
			"currency": "USD",
		})
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
				patch("frappe.db.get_value", side_effect=[1, fake_course]), \
				patch("lms.lms.utils.get_membership", return_value=None), \
				patch("lms.lms.utils.can_modify_course", return_value=True), \
				patch("lms.lms.utils.get_course_fields", return_value=["name","course_price","currency"]), \
				patch("lms.lms.utils.get_instructors", return_value=[]), \
				patch("frappe.db.count", return_value=0), \
				patch("lms.lms.utils.get_course_content_stats", return_value={}), \
				patch("frappe.session") as mock_session:
			mock_session.user = "Guest"

			result = get_course_details("curso4")
			self.assertFalse(result.is_instructor)

	# UT-UTILS-079
	def test_course_details_course_with_membership_and_current_lesson(self):
		""" Valida que get_course_details recupere y asigne la lección actual desde la membresía del usuario. """
		fake_course = _dict({
			"name": "curso5",
			"paid_course": False,
			"paid_certificate": False,
			"course_price": 0,
			"currency": "USD",
		})
		fake_membership = _dict({"current_lesson": "lesson1"})
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
				patch("frappe.db.get_value", side_effect=[1, fake_course]), \
				patch("lms.lms.utils.get_membership", return_value=fake_membership), \
				patch("lms.lms.utils.can_modify_course", return_value=True), \
				patch("lms.lms.utils.get_course_fields", return_value=["name","course_price","currency"]), \
				patch("lms.lms.utils.get_instructors", return_value=[]), \
				patch("frappe.db.count", return_value=0), \
				patch("lms.lms.utils.get_course_content_stats", return_value={}), \
				patch("lms.lms.utils.get_lesson_index", return_value="1-1"), \
				patch("frappe.session") as mock_user:
			mock_user.user = "user@example.com"

			result = get_course_details("curso5")
			self.assertEqual(result.current_lesson, "1-1")

	# UT-UTILS-080
	def test_get_categorized_courses_under_review(self):
		""" Verifica que categorize_courses asigne cursos con estado 'Under Review' a la categoría correspondiente. """
		courses = [_dict({"name": "c1", "status": "Under Review"})]
		result = get_categorized_courses(courses)
		self.assertEqual(result["under_review"][0].name, "c1")

	# UT-UTILS-081
	def test_get_categorized_courses_upcoming_course(self):
		""" Comprueba que los cursos con el flag 'upcoming' se agrupen bajo la clave 'upcoming'. """
		courses = [_dict({"name": "c2", "status": "Active", "published": 1, "upcoming": 1})]
		result = get_categorized_courses(courses)
		self.assertEqual(result["upcoming"][0].name, "c2")

	# UT-UTILS-082
	def test_get_categorized_courses_new_course_recent(self):
		""" Valida que un curso publicado recientemente se categorice como 'new'. """
		fake_course = _dict({
			"name": "c4",
			"status": "Active",
			"published": 1,
			"upcoming": 0,
			"published_on": "2026-06-01",  # fecha reciente
		})
		with patch("lms.lms.utils.getdate", return_value="2026-06-09"), \
				patch("lms.lms.utils.add_months", return_value="2026-03-09"):
			result = get_categorized_courses([fake_course])
			self.assertEqual(result["new"][0].name, "c4")

	# UT-UTILS-083
	def test_get_categorized_courses_enrolled_course(self):
		""" Verifica que los cursos con membresía activa se asignen a la categoría 'enrolled'. """
		courses = [_dict({"name": "c5", "status": "Active", "membership": True})]
		result = get_categorized_courses(courses)
		self.assertEqual(result["enrolled"][0].name, "c5")

	# UT-UTILS-084
	def test_get_categorized_courses_created_course(self):
		""" Comprueba que si el usuario es instructor del curso, este se agrupe bajo 'created'. """
		courses = [_dict({"name": "c6", "status": "Active", "membership": None, "is_instructor": True})]
		result = get_categorized_courses(courses)
		self.assertEqual(result["created"][0].name, "c6")

	# UT-UTILS-085
	def test_get_course_outline_when_guest_access_denied(self):
		""" Verifica que get_course_outline retorne una lista vacía si el acceso a invitados está deshabilitado. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=False):
			result = get_course_outline("curso1")
			self.assertEqual(result, [])

	# UT-UTILS-086
	def test_get_course_outline_when_no_chapters(self):
		""" Valida que el contorno del curso sea una lista vacía si no existen capítulos asociados. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
				patch("lms.lms.utils.get_outline_chapter", return_value=[]):
			result = get_course_outline("curso2")
			self.assertEqual(result, [])

	# UT-UTILS-087
	def test_get_course_outline_when_normal_flow_without_progress(self):
		""" Comprueba la construcción del contorno normal de un curso sin información de progreso. """
		fake_chapter = _dict({"name": "ch1"})
		fake_lessons = [{"lesson": "l1"}]
		fake_files = {"ch1": "file1"}
		fake_outline = [{"chapter": "ch1", "lessons": ["l1"]}]

		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
				patch("lms.lms.utils.get_outline_chapter", return_value=[fake_chapter]), \
				patch("lms.lms.utils.get_outline_lessons", return_value=fake_lessons), \
				patch("lms.lms.utils.get_scorm_files", return_value=fake_files), \
				patch("lms.lms.utils.build_outline", return_value=fake_outline):

			result = get_course_outline("curso3", progress=False)
			self.assertEqual(result, fake_outline)

	# UT-UTILS-088
	def test_get_course_outline_when_normal_flow_with_progress(self):
		""" Verifica la construcción del contorno del curso incluyendo los datos de progreso de las lecciones. """
		fake_chapter = _dict({"name": "ch2"})
		fake_lessons = [{"lesson": "l2"}]
		fake_files = {"ch2": "file2"}
		fake_outline = [{"chapter": "ch2", "lessons": ["l2"], "completed": ["l2"]}]

		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
				patch("lms.lms.utils.get_outline_chapter", return_value=[fake_chapter]), \
				patch("lms.lms.utils.get_outline_lessons", return_value=fake_lessons), \
				patch("lms.lms.utils.get_scorm_files", return_value=fake_files), \
				patch("lms.lms.utils.get_completed_lessons", return_value={"l2"}), \
				patch("lms.lms.utils.build_outline", return_value=fake_outline):

			result = get_course_outline("curso4", progress=True)
			self.assertEqual(result, fake_outline)

	# UT-UTILS-089
	def test_get_outline_chapter_with_chapters(self):
		""" Valida que get_outline_chapter construya y ejecute la consulta correcta para retornar capítulos. """
		fake_result = [
			{
				"idx": 1,
				"name": "ch1",
				"title": "Intro",
				"is_scorm_package": 0,
				"launch_file": None,
				"scorm_package": None,
			}
		]

		with patch("frappe.qb.DocType"), \
				patch("frappe.qb.from_") as mock_from:

			# Simula el objeto query con método run
			mock_query = mock_from.return_value
			mock_query.join.return_value = mock_query
			mock_query.on.return_value = mock_query
			mock_query.select.return_value = mock_query
			mock_query.where.return_value = mock_query
			mock_query.orderby.return_value = mock_query
			mock_query.run.return_value = fake_result

			result = get_outline_chapter("curso1")
			self.assertEqual(result, fake_result)

	# UT-UTILS-090
	def test_get_outline_lessons_with_lessons(self):
		""" Verifica que get_outline_lessons recupere la lista detallada de lecciones de la base de datos. """
		fake_result = [
			{
				"chapter_name": "ch1",
				"lesson_idx": 1,
				"name": "lesson1",
				"title": "Intro",
				"include_in_preview": 1,
				"body": "contenido",
				"content": "{}",
				"youtube": None,
				"quiz_id": None,
				"question": None,
				"file_type": "text",
				"course": "curso1",
				"chapter": "ch1",
			}
		]

		with patch("frappe.qb.DocType"), \
				patch("frappe.qb.from_") as mock_from:

			# Simula el objeto query con método run
			mock_query = mock_from.return_value
			mock_query.join.return_value = mock_query
			mock_query.on.return_value = mock_query
			mock_query.select.return_value = mock_query
			mock_query.where.return_value = mock_query
			mock_query.orderby.return_value = mock_query
			mock_query.run.return_value = fake_result

			result = get_outline_lessons(["ch1"])
			self.assertEqual(result, fake_result)

	# UT-UTILS-091
	def test_get_scorm_files_no_scorm_files(self):
		""" Comprueba que retorne un diccionario vacío si no hay paquetes SCORM en los capítulos. """
		chapters = [
			_dict({"is_scorm_package": False, "scorm_package": None}),
			_dict({"is_scorm_package": True, "scorm_package": None}),
		]
		result = get_scorm_files(chapters)
		self.assertEqual(result, {})

	# UT-UTILS-092
	def test_get_scorm_files_with_scorm_files(self):
		""" Valida la recuperación y mapeo correcto de los detalles de los archivos SCORM. """
		chapters = [
			_dict({"is_scorm_package": True, "scorm_package": "file1"}),
			_dict({"is_scorm_package": True, "scorm_package": "file2"}),
		]
		fake_files = [
			_dict({"name": "file1", "file_name": "f1.zip", "file_size": 123, "file_url": "/files/f1.zip"}),
			_dict({"name": "file2", "file_name": "f2.zip", "file_size": 456, "file_url": "/files/f2.zip"}),
		]

		with patch("frappe.get_all", return_value=fake_files) as mock_get_all:
			result = get_scorm_files(chapters)

			# Verifica que devuelve un dict con las entradas correctas
			self.assertEqual(result["file1"]["file_name"], "f1.zip")
			self.assertEqual(result["file2"]["file_size"], 456)

	# UT-UTILS-093
	def test_get_completed_lessons_guest_user_returns_empty_set(self):
		""" Verifica que se retorne un set vacío de lecciones completadas para usuarios invitados. """
		with patch("frappe.session") as mock_session:
			mock_session.user = "Guest"
			result = get_completed_lessons("curso1", [{"name": "l1"}])
			self.assertEqual(result, set())

	# UT-UTILS-094
	def test_get_completed_lessons_empty_lesson_rows_returns_empty_set(self):
		""" Comprueba que devuelva un set vacío si no se proporcionan filas de lecciones. """
		with patch("frappe.session") as mock_session:
			mock_session.user = "user@example.com"
			result = get_completed_lessons("curso2", [])
			self.assertEqual(result, set())

	# UT-UTILS-095
	def test_get_completed_lessons_with_completed_lessons(self):
		""" Valida la recuperación de las lecciones completadas por el usuario actual devolviendo un set de nombres. """
		lesson_rows = [_dict({"name": "l1"}), _dict({"name": "l2"})]
		with patch("frappe.session") as mock_session, \
				patch("frappe.get_all", return_value=["l1"]):
			mock_session.user = "user@example.com"
			result = get_completed_lessons("curso3", lesson_rows)
			self.assertEqual(result, {"l1"})

	# UT-UTILS-096
	def test_build_outline_lessons_with_progress(self):
		""" Verifica que build_outline marque adecuadamente el atributo is_complete en las lecciones con progreso. """
		chapters = [_dict({"name": "ch1", "title": "Intro", "is_scorm_package": 0, "launch_file": None, "scorm_package": None, "idx": 1})]
		lesson_rows = [_dict({"name": "l1", "title": "Lesson 1", "include_in_preview": 1, "body": "b", "content": "{}", "youtube": None,
								"quiz_id": None, "question": None, "file_type": "text", "course": "c1", "chapter": "ch1", "chapter_name": "ch1", "lesson_idx": 1})]

		with patch("lms.lms.utils.get_lesson_icon", return_value="icon.png"):
			result = build_outline(chapters, lesson_rows, {}, {"l1"}, progress=True)
			self.assertTrue(result[0].lessons[0].is_complete)

	# UT-UTILS-097
	def test_build_outline_chapter_with_scorm_file(self):
		""" Comprueba que asigne correctamente los datos del archivo SCORM al capítulo si existe correspondencia. """
		chapters = [_dict({"name": "ch2", "title": "SCORM Chapter", "is_scorm_package": 1, "launch_file": "launch.html", "scorm_package": "file1", "idx": 2})]
		lesson_rows = []
		files_by_name = {"file1": _dict({"name": "file1", "file_url": "/files/file1.zip"})}

		result = build_outline(chapters, lesson_rows, files_by_name, set(), progress=False)
		self.assertEqual(result[0].scorm_package["file_url"], "/files/file1.zip")

	# UT-UTILS-098
	def test_build_outline_chapter_without_scorm_file(self):
		""" Valida que mantenga el nombre original si el paquete SCORM asociado no existe en el diccionario de archivos. """
		chapters = [_dict({"name": "ch3", "title": "Normal Chapter", "is_scorm_package": 1, "launch_file": "launch.html", "scorm_package": "fileX", "idx": 3})]
		lesson_rows = []
		files_by_name = {"file1": _dict({"name": "file1", "file_url": "/files/file1.zip"})}

		result = build_outline(chapters, lesson_rows, files_by_name, set(), progress=False)
		# Se mantiene el valor original porque fileX no está en files_by_name
		self.assertEqual(result[0].scorm_package, "fileX")

	# UT-UTILS-099
	def test_get_lesson_guest_denied(self):
		""" Retorna diccionario vacío si el acceso de invitado está denegado para la lección. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=False):
			self.assertEqual(get_lesson("curso1", 1, 1), {})

	# UT-UTILS-100
	def test_get_lesson_chapter_not_found(self):
		""" Retorna diccionario vacío si no se encuentra el capítulo de la lección en la base de datos. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.qb.from_") as mock_from:
			mock_query = mock_from.return_value
			for method in ['join', 'on', 'select', 'where', 'limit']:
				getattr(mock_query, method).return_value = mock_query
			mock_query.run.return_value = []
			self.assertEqual(get_lesson("curso1", 1, 1), {})

	# UT-UTILS-101
	def test_get_lesson_lesson_not_found(self):
		""" Retorna diccionario vacío si no se encuentra el registro específico de la lección. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.qb.from_") as mock_from, \
			patch("frappe.db.get_value", return_value=None):
			mock_query = mock_from.return_value
			for method in ['join', 'on', 'select', 'where', 'limit']:
				getattr(mock_query, method).return_value = mock_query
			mock_query.run.return_value = [_dict({"name": "c1", "title": "t1"})]
			self.assertEqual(get_lesson("curso1", 1, 1), {})

	# UT-UTILS-102
	def test_get_lesson_lesson_details_not_found(self):	
		""" Retorna diccionario vacío si no se logran recuperar los detalles extendidos de la lección. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.qb.from_") as mock_from, \
			patch("frappe.db.get_value", side_effect=["lesson_name", None]):
			mock_query = mock_from.return_value
			for method in ['join', 'on', 'select', 'where', 'limit']:
				getattr(mock_query, method).return_value = mock_query
			mock_query.run.return_value = [_dict({"name": "c1", "title": "t1"})]
			self.assertEqual(get_lesson("curso1", 1, 1), {})

	# UT-UTILS-103
	def test_get_lesson_is_scorm_package(self):
		""" Verifica que la lección devuelva is_scorm_package como True si está configurada como paquete SCORM. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.qb.from_") as mock_from, \
			patch("frappe.db.get_value", side_effect=["lesson_name", _dict({"is_scorm_package": True})]):
			mock_query = mock_from.return_value
			for method in ['join', 'on', 'select', 'where', 'limit']:
				getattr(mock_query, method).return_value = mock_query
			mock_query.run.return_value = [_dict({"name": "c1", "title": "t1"})]
			result = get_lesson("curso1", 1, 1)
			self.assertTrue(result["is_scorm_package"])

	# UT-UTILS-104
	def test_get_lesson_no_preview(self):
		""" Establece no_preview en 1 si la lección no incluye vista previa y el usuario no tiene membresía ni acceso. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.qb.from_") as mock_from, \
			patch("frappe.db.get_value", side_effect=["lesson_name", _dict({"include_in_preview": 0, "title": "t"}), _dict({"title": "Course", "disable_self_learning": 0})]), \
			patch("lms.lms.utils.get_membership", return_value=False), \
			patch("lms.lms.utils.can_modify_course", return_value=False):
			mock_query = mock_from.return_value
			for method in ['join', 'on', 'select', 'where', 'limit']:
				getattr(mock_query, method).return_value = mock_query
			mock_query.run.return_value = [_dict({"name": "c1", "title": "t1"})]
			result = get_lesson("curso1", 1, 1)
			self.assertEqual(result["no_preview"], 1)

	# UT-UTILS-105
	def test_get_lesson_guest_progress(self):
		""" Asegura que el progreso de la lección para un usuario invitado siempre se calcule como 0. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.qb.from_") as mock_from, \
			patch("frappe.db.get_value", side_effect=["lesson_name", _dict({"include_in_preview": 1, "name": "l1"}), _dict({"title": "Course", "disable_self_learning": 0, "paid_certificate": 0})]), \
			patch("lms.lms.utils.get_membership", return_value=True), \
			patch("frappe.session", _dict({"user": "Guest"})), \
			patch("lms.lms.utils.get_neighbour_lesson", return_value={"next": None, "prev": None}), \
			patch("lms.lms.utils.get_lesson_icon", return_value="icon"), \
			patch("lms.lms.utils.get_instructors", return_value=[]), \
			patch("lms.lms.utils.get_video_details", return_value=[]):
			mock_query = mock_from.return_value
			for method in ['join', 'on', 'select', 'where', 'limit']:
				getattr(mock_query, method).return_value = mock_query
			mock_query.run.return_value = [_dict({"name": "c1", "title": "t1"})]
			result = get_lesson("curso1", 1, 1)
			self.assertEqual(result.progress, 0)

	# UT-UTILS-106
	def test_get_lesson_user_progress(self):
		""" Obtiene y asigna correctamente el porcentaje de progreso de la lección para un usuario autenticado. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.qb.from_") as mock_from, \
			patch("frappe.db.get_value", side_effect=["lesson_name", _dict({"include_in_preview": 1, "name": "l1"}), _dict({"title": "Course", "disable_self_learning": 0, "paid_certificate": 0})]), \
			patch("lms.lms.utils.get_membership", return_value=True), \
			patch("frappe.session", _dict({"user": "user1"})), \
			patch("lms.lms.utils.get_progress", return_value=50), \
			patch("lms.lms.utils.get_neighbour_lesson", return_value={"next": None, "prev": None}), \
			patch("lms.lms.utils.get_lesson_icon", return_value="icon"), \
			patch("lms.lms.utils.get_instructors", return_value=[]), \
			patch("lms.lms.utils.get_video_details", return_value=[]):
			mock_query = mock_from.return_value
			for method in ['join', 'on', 'select', 'where', 'limit']:
				getattr(mock_query, method).return_value = mock_query
			mock_query.run.return_value = [_dict({"name": "c1", "title": "t1"})]
			result = get_lesson("curso1", 1, 1)
			self.assertEqual(result.progress, 50)

	# UT-UTILS-107
	def test_get_video_details(self):
		""" Consulta y retorna el tiempo de visualización guardado de un video para el usuario en sesión. """
		with patch("frappe.get_all", return_value=[{"source": "s", "watch_time": 10}]) as mock_get_all, \
			patch("frappe.session", _dict({"user": "user@example.com"})):
			result = get_video_details("lesson1")
			self.assertEqual(result[0]["watch_time"], 10)
			mock_get_all.assert_called_once_with("LMS Video Watch Duration", {"lesson": "lesson1", "member": "user@example.com"}, ["source", "watch_time"])

	# UT-UTILS-108
	def test_get_neighbour_lesson(self):
		""" Resuelve los índices estructurales (prev/next) de las lecciones contiguas a partir del índice actual. """
		with patch("frappe.qb.from_") as mock_from:
			mock_query = mock_from.return_value
			for method in ['join', 'on', 'select', 'where', 'orderby']:
				getattr(mock_query, method).return_value = mock_query
			mock_query.run.return_value = [
				_dict({"chapter_idx": 1, "lesson_idx": 1}),
				_dict({"chapter_idx": 1, "lesson_idx": 2}),
				_dict({"chapter_idx": 2, "lesson_idx": 1}),
			]
			
			self.assertEqual(get_neighbour_lesson("curso1", 1, 2), {"prev": "1.1", "next": "2.1"})
			self.assertEqual(get_neighbour_lesson("curso1", 1, 1), {"prev": None, "next": "1.2"})
			self.assertEqual(get_neighbour_lesson("curso1", 2, 1), {"prev": "1.2", "next": None})
			self.assertEqual(get_neighbour_lesson("curso1", 3, 1), {"prev": None, "next": None})

	# UT-UTILS-109
	def test_get_batch_details_guest_denied(self):
		""" Retorna un diccionario vacío si se solicitan los detalles de un batch y el acceso a invitados está denegado. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=False):
			self.assertEqual(get_batch_details("batch1"), {})

	# UT-UTILS-110
	def test_get_batch_details_no_access(self):
		""" Retorna vacío si el usuario autenticado no está inscrito ni posee permisos de modificación sobre el batch. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.get_all", return_value=["student1@example.com"]), \
			patch("lms.lms.utils.can_modify_batch", return_value=False), \
			patch("frappe.db.get_value", return_value=0), \
			patch("frappe.session", _dict({"user": "student2@example.com"})):
			self.assertEqual(get_batch_details("batch1"), {})

	# UT-UTILS-111
	def test_get_batch_details_student_enrolled(self):
		""" Obtiene correctamente el detalle de cupos, estudiantes inscritos y precio formateado de un batch publicado. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.get_all", side_effect=[["student1@example.com"], [], []]), \
			patch("lms.lms.utils.can_modify_batch", return_value=False), \
			patch("frappe.db.get_value", side_effect=[0, _dict({"start_date": "2024-01-01", "start_time": "10:00:00", "paid_batch": 1, "amount": 100, "currency": "USD", "amount_usd": 100, "seat_count": 10})]), \
			patch("frappe.session", _dict({"user": "student1@example.com"})), \
			patch("lms.lms.utils.get_instructors", return_value=[]), \
			patch("lms.lms.utils.getdate", return_value="2023-01-01"), \
			patch("lms.lms.utils.nowtime", return_value="09:00:00"), \
			patch("lms.lms.utils.check_multicurrency", return_value=(100, "USD")), \
			patch("lms.lms.utils.fmt_money", return_value="$100"):
			result = get_batch_details("batch1")
			self.assertTrue(result.accept_enrollments)
			self.assertEqual(result.seats_left, 9)
			self.assertEqual(result.students, ["student1@example.com"])
			self.assertEqual(result.price, "$100")

	# UT-UTILS-112
	def test_get_batch_details_admin_not_accept_enrollment(self):
		""" Verifica que el sistema marque 'accept_enrollments' como False si el batch gratuito no cuenta con cupos disponibles. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.get_all", side_effect=[[], [], []]), \
			patch("lms.lms.utils.can_modify_batch", return_value=True), \
			patch("frappe.db.get_value", side_effect=[0, _dict({"start_date": "2022-01-01", "start_time": "10:00:00", "paid_batch": 0, "seat_count": 0})]), \
			patch("frappe.session", _dict({"user": "admin@example.com"})), \
			patch("lms.lms.utils.get_instructors", return_value=[]), \
			patch("lms.lms.utils.getdate", return_value="2023-01-01"):
			result = get_batch_details("batch1")
			self.assertFalse(result.accept_enrollments)
			self.assertEqual(result.students, [])

	# UT-UTILS-113
	def test_categorize_batches(self):
		""" Agrupa un arreglo de batches en categorías lógicas (privado, archivado, próximo e inscrito) basándose en sus fechas. """
		import datetime
		def mock_getdate(date_str=None):
			if date_str:
				return datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
			return datetime.date(2023, 1, 1)

		with patch("frappe.session", _dict({"user": "user@example.com"})), \
			patch("frappe.db.exists", return_value=True),   \
			patch("lms.lms.utils.getdate", side_effect=mock_getdate), \
			patch("lms.lms.utils.nowtime", return_value="10:00:00"):
			batches = [
				_dict({"name": "b1", "published": 0, "start_date": "2025-01-01", "start_time": "10:00:00"}),
				_dict({"name": "b2", "published": 1, "start_date": "2020-01-01", "start_time": "10:00:00"}),
				_dict({"name": "b3", "published": 1, "start_date": "2023-01-01", "start_time": "09:00:00"}),
				_dict({"name": "b4", "published": 1, "start_date": "2030-01-01", "start_time": "10:00:00"}),
			]
			result = categorize_batches(batches)
			self.assertEqual(result["private"][0].name, "b1")
			self.assertEqual(result["archived"][0].name, "b3")
			self.assertEqual(result["archived"][1].name, "b2")
			self.assertEqual(result["upcoming"][0].name, "b4")
			self.assertEqual(len(result["enrolled"]), 4)

		with patch("frappe.session", _dict({"user": "Guest"})), \
			patch("lms.lms.utils.getdate", side_effect=mock_getdate), \
			patch("lms.lms.utils.nowtime", return_value="10:00:00"):
			batches = [_dict({"name": "b1", "published": 0, "start_date": "2025-01-01", "start_time": "10:00:00"})]
			result2 = categorize_batches(batches)
			self.assertEqual(len(result2["enrolled"]), 0)

	# UT-UTILS-114
	def test_get_country_code(self):
		""" Resuelve el nombre del país a partir de la IP conectada llamando a una API, o devuelve None ante un fallo. """
		with patch("frappe.local.request_ip", return_value="127.0.0.1"), \
			patch("requests.get") as mock_get, \
			patch("frappe.db.get_value", return_value="United States"):	
			mock_res = MagicMock()
			mock_res.json.return_value = {"status": "success", "countryCode": "US"}
			mock_get.return_value = mock_res
			self.assertEqual(get_country_code(), "United States")
			
			mock_res.json.return_value = {"status": "fail"}
			self.assertIsNone(get_country_code())

			mock_res.json.side_effect = Exception("error")
			self.assertIsNone(get_country_code())

	# UT-UTILS-115
	def test_get_quiz_with_questions_no_role(self):
		""" Lanza una excepción de tipo ValidationError si el usuario intenta extraer preguntas sin tener el rol en el LMS. """
		with patch("lms.lms.utils.has_lms_role", return_value=False):
			with self.assertRaises(frappe.exceptions.ValidationError):
				get_quiz_with_questions("quiz1")

	# UT-UTILS-116
	def test_get_quiz_with_questions_no_questions(self):
		""" Retorna el documento principal del quiz y un diccionario vacío para las preguntas si este carece de ellas. """
		with patch("lms.lms.utils.has_lms_role", return_value=True), \
			patch("frappe.get_doc") as mock_get_doc:
			mock_quiz = MagicMock()
			mock_quiz.as_dict.return_value = {"name": "quiz1", "questions": []}
			mock_get_doc.return_value = mock_quiz
			
			result = get_quiz_with_questions("quiz1")
			self.assertEqual(result["quiz"]["name"], "quiz1")
			self.assertEqual(result["questions_by_name"], {})

	# UT-UTILS-117
	def test_get_quiz_with_questions_with_questions(self):
		""" Devuelve la estructura del quiz y un mapa de las preguntas asociadas utilizando su identificador nominal. """
		with patch("lms.lms.utils.has_lms_role", return_value=True), \
			patch("frappe.get_doc") as mock_get_doc, \
			patch("frappe.get_all", return_value=[{"name": "q1", "question": "What is Python?"}]):
			mock_quiz = MagicMock()
			mock_quiz.as_dict.return_value = {"name": "quiz1", "questions": [{"question": "q1"}]}
			mock_get_doc.return_value = mock_quiz
			
			result = get_quiz_with_questions("quiz1")
			self.assertEqual(result["quiz"]["name"], "quiz1")
			self.assertEqual(result["questions_by_name"]["q1"]["question"], "What is Python?")

	# UT-UTILS-118
	def test_get_batch_courses_guest(self):
		""" Retorna una lista vacía de cursos al solicitar los detalles de un batch operando bajo un acceso denegado a invitados. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=False):
			self.assertEqual(get_batch_courses("batch1"), [])

	# UT-UTILS-119
	def test_get_batch_courses_valid(self):
		""" Reúne y retorna un conjunto válido de cursos interrelacionados con el identificador del batch provisto. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.get_all", return_value=[_dict({"name": "bc1", "course": "c1"}), _dict({"name": "bc2", "course": "c2"})]), \
			patch("lms.lms.utils.get_course_details", side_effect=[_dict({"name": "c1", "title": "Course 1"}), _dict({})]):
			result = get_batch_courses("batch1")
			self.assertEqual(len(result), 1)
			self.assertEqual(result[0].batch_course, "bc1")

	# UT-UTILS-120
	def test_get_assessments_no_access(self):
		""" Activa una validación de error en la API de evaluaciones si la solicitud es forjada para un batch inaccesible/inexistente. """
		with patch("frappe.session", _dict({"user": "user@example.com"})), \
			patch("frappe.db.exists", return_value=False), \
			patch("lms.lms.utils.can_modify_batch", return_value=False):
			with self.assertRaises(frappe.exceptions.ValidationError):
				get_assessments("batch1")

	# UT-UTILS-121
	def test_get_assessments_valid(self):
		""" Despacha una lista consolidada con la configuración de tareas, cuestionarios y ejercicios dictados en el batch. """
		with patch("frappe.session", _dict({"user": "user@example.com"})), \
			patch("frappe.db.exists", return_value=True), \
			patch("frappe.get_all", return_value=[
					_dict({"assessment_type": "LMS Assignment", "assessment_name": "ass1"}),
					_dict({"assessment_type": "LMS Quiz", "assessment_name": "quiz1"}),
					_dict({"assessment_type": "LMS Programming Exercise", "assessment_name": "ex1"})]), \
			patch("lms.lms.utils.get_assignment_details", return_value=_dict({"assessment_name": "ass1"})), \
			patch("lms.lms.utils.get_quiz_details", return_value=_dict({"assessment_name": "quiz1"})), \
			patch("lms.lms.utils.get_exercise_details", return_value=_dict({"assessment_name": "ex1"})):
			result = get_assessments("batch1")
			self.assertEqual(len(result), 3)

	# UT-UTILS-122
	def test_get_assignment_details_not_attempted(self):
		""" Imprime el estado como 'Not Attempted' e inhabilita la bandera 'completed' si el usuario no tiene registros de asignación. """
		with patch("frappe.db.get_value", return_value="Assignment Title"), \
			patch("frappe.db.exists", return_value=False), \
			patch("lms.lms.utils.get_lms_route", return_value="/lms/route"):
			assessment = _dict({"assessment_name": "ass1"})
			result = get_assignment_details(assessment, "user1")
			self.assertEqual(result.title, "Assignment Title")
			self.assertEqual(result.status, "Not Attempted")
			self.assertFalse(result.completed)

	# UT-UTILS-123
	def test_get_assignment_details_attempted(self):
		""" Verifica que el sistema fije 'completed' en True y refleje la calificación real de una asignación ya enviada. """
		with patch("frappe.db.exists", return_value="sub1"), \
			patch("frappe.db.get_value", side_effect=["Assignment Title", _dict({"name": "sub1", "status": "Pass", "comments": ""})]), \
			patch("lms.lms.utils.get_lms_route", return_value="/lms/route"):
			assessment = _dict({"assessment_name": "ass1"})
			result = get_assignment_details(assessment, "user1")
			self.assertTrue(result.completed)
			self.assertEqual(result.status, "Pass")

	# UT-UTILS-124
	def test_get_quiz_details_attempted(self):
		""" Extrae y anexa correctamente la puntuación, validando la terminación del quiz una vez realizado el intento. """
		with patch("frappe.db.get_value", return_value=_dict({"title": "Quiz Title", "passing_percentage": 50})), \
			patch("frappe.get_all", return_value=[_dict({"name": "sub1", "percentage": 80, "score": 8})]), \
			patch("lms.lms.utils.get_lms_route", return_value="/lms/route"):
			assessment = _dict({"assessment_name": "quiz1"})
			result = get_quiz_details(assessment, "user1")
			self.assertTrue(result.completed)
			self.assertEqual(result.status, 80)
			self.assertEqual(result.submission.name, "sub1")

	# UT-UTILS-125
	def test_get_quiz_details_not_attempted(self):
		""" Aplica el estado 'Not Attempted' a la evaluación de tipo quiz si la base de datos no contiene sumisiones asociadas. """
		with patch("frappe.db.get_value", return_value=_dict({"title": "Quiz Title", "passing_percentage": 50})), \
			patch("frappe.get_all", return_value=[]), \
			patch("lms.lms.utils.get_lms_route", return_value="/lms/route"):
			assessment = _dict({"assessment_name": "quiz1"})
			result = get_quiz_details(assessment, "user1")
			self.assertFalse(result.completed)
			self.assertEqual(result.status, "Not Attempted")

	# UT-UTILS-126
	def test_get_exercise_details_not_attempted(self):
		""" Configura el detalle de un ejercicio de programación sin intentos a estado neutro ('Not Attempted'). """
		with patch("frappe.db.get_value", return_value="Exercise Title"), \
			patch("frappe.db.exists", return_value=False), \
			patch("lms.lms.utils.get_lms_route", return_value="/lms/route"):
			assessment = _dict({"assessment_name": "ex1"})
			get_exercise_details(assessment, "user1")
			self.assertEqual(assessment.status, "Not Attempted")
			self.assertFalse(assessment.completed)

	# UT-UTILS-127
	def test_get_exercise_details_attempted(self):
		""" Marca como 'Pass' y completado el objeto de evaluación de un ejercicio programático tras su respectiva validación. """
		with patch("frappe.db.get_value", side_effect=["Exercise Title", _dict({"status": "Pass"})]), \
			patch("frappe.db.exists", return_value="sub1"), \
			patch("lms.lms.utils.get_lms_route", return_value="/lms/route"):
			assessment = _dict({"assessment_name": "ex1"})
			get_exercise_details(assessment, "user1")
			self.assertEqual(assessment.status, "Pass")
			self.assertTrue(assessment.completed)

	# UT-UTILS-128
	def test_get_batch_student_progress_no_access(self):
		""" Previene el acceso mediante ValidationError si el solicitante intenta ver métricas ajenas del batch sin rol de gestión. """
		with patch("lms.lms.utils.can_modify_batch", return_value=False):
			with self.assertRaises(frappe.exceptions.ValidationError):
				get_batch_student_progress("user1", "batch1")

	# UT-UTILS-129
	def test_get_batch_student_progress(self):
		""" Confirma la ejecución de cálculo asíncrono para despachar el porcentaje de avance individual dentro de un batch válido. """
		with patch("lms.lms.utils.can_modify_batch", return_value=True), \
			patch("lms.lms.utils.get_batch_student_details", return_value=_dict({"email": "user1@example.com"})), \
			patch("lms.lms.utils.calculate_student_progress") as mock_calc:
			result = get_batch_student_progress("user1", "batch1")
			self.assertEqual(result.email, "user1@example.com")
			mock_calc.assert_called_once_with("batch1", result)

	# UT-UTILS-130
	def test_get_course_completion_stats(self):
		""" Agrupa y emite una estadística cuantitativa representando a los integrantes del batch con cursos completados exitosamente. """
		with patch("frappe.qb.from_") as mock_from:
			mock_query = mock_from.return_value
			for method in ['left_join', 'on', 'where', 'groupby', 'select']:
				getattr(mock_query, method).return_value = mock_query
			mock_query.run.return_value = [_dict({"title": "Course 1", "completed": 5})]
			result = get_course_completion_stats("batch1")
			self.assertEqual(result, [{"task": "Course 1", "value": 5}])

	# UT-UTILS-131
	def test_get_assignment_pass_stats(self):
		""" Extrae el conteo estricto del volumen de asignaciones (tareas) resueltas y superadas correspondientes a un batch. """
		with patch("frappe.qb.from_") as mock_from:
			mock_query = mock_from.return_value
			for method in ['join', 'on', 'left_join', 'where', 'groupby', 'select']:
				getattr(mock_query, method).return_value = mock_query
			mock_query.run.return_value = [_dict({"title": "Ass 1", "passed": 3})]
			result = get_assignment_pass_stats("batch1")
			self.assertEqual(result, [{"task": "Ass 1", "value": 3}])
			
	# UT-UTILS-132
	def test_get_quiz_pass_stats(self):
		""" Despliega la métrica agregada del número de cuestionarios (quizzes) cursados con nota aprobatoria en la cohorte. """
		with patch("frappe.qb.from_") as mock_from:
			mock_query = mock_from.return_value
			for method in ['join', 'on', 'left_join', 'where', 'groupby', 'select']:
				getattr(mock_query, method).return_value = mock_query
			mock_query.run.return_value = [_dict({"title": "Quiz 1", "passed": 2})]
			result = get_quiz_pass_stats("batch1")
			self.assertEqual(result, [{"task": "Quiz 1", "value": 2}])

	# UT-UTILS-133
	def test_get_batch_chart_data_no_access(self):
		""" Restringe la lectura analítica global forzando un error si la consulta al panel gráfico se efectúa sin permisos. """
		with patch("lms.lms.utils.can_modify_batch", return_value=False):
			with self.assertRaises(frappe.exceptions.ValidationError):
				get_batch_chart_data("batch1")

	# UT-UTILS-134
	def test_get_batch_chart_data_no_batch(self):
		""" Bloquea la renderización visual arrojando una excepción cuando el batch solicitado no se encuentra en el registro. """
		with patch("lms.lms.utils.can_modify_batch", return_value=True), \
			patch("frappe.db.exists", return_value=False):
			with self.assertRaises(frappe.exceptions.ValidationError):
				get_batch_chart_data("batch1")

	# UT-UTILS-135
	def test_get_batch_chart_data(self):
		""" Engloba de manera efectiva las listas estadísticas de cursos, asignaciones y quizzes en un objeto JSON único para gráficos. """
		with patch("lms.lms.utils.can_modify_batch", return_value=True), \
			patch("frappe.db.exists", return_value=True), \
			patch("lms.lms.utils.get_course_completion_stats", return_value=[{"task": "c", "value": 1}]), \
			patch("lms.lms.utils.get_assignment_pass_stats", return_value=[{"task": "a", "value": 2}]), \
			patch("lms.lms.utils.get_quiz_pass_stats", return_value=[{"task": "q", "value": 3}]):
			result = get_batch_chart_data("batch1")
			self.assertEqual(len(result), 3)

	# UT-UTILS-136
	def test_calculate_course_progress(self):
		""" Inyecta el atributo del progreso promedio al dict de detalles basándose en la obtención de porcentajes individuales del usuario. """
		with patch("frappe.db.get_value", return_value=50):
			batch_courses = [_dict({"course": "c1", "title": "Course 1"}), _dict({"course": "c2", "title": "Course 2"})]
			details = _dict({"email": "user1"})
			calculate_course_progress(batch_courses, details)
			self.assertEqual(details.average_course_progress, 50.0)

	# UT-UTILS-137
	def test_calculate_assessment_progress(self):
		""" Sanciona un porcentaje del cien por cien si el resultado de evaluación es un estado equivalente a la aprobación (Pass). """
		with patch("frappe.db.get_value", return_value="Title"), \
			patch("lms.lms.utils.has_submitted_assessment", return_value=_dict({"result": "Pass"})):
			assessments = [_dict({"assessment_name": "a1", "assessment_type": "LMS Assignment"})]
			details = _dict({"email": "user1"})
			calculate_assessment_progress(assessments, details)
			self.assertEqual(details.average_assessments_progress, 100.0)

	# UT-UTILS-138
	def test_calculate_assessment_progress_failed(self):
		""" Registra el porcentaje de superación en cero plano al detectar un estatus equivalente a fallado (Fail) en las revisiones. """
		with patch("frappe.db.get_value", return_value="Title"), \
			patch("lms.lms.utils.has_submitted_assessment", return_value=_dict({"result": "Fail"})):
			assessments = [_dict({"assessment_name": "a1", "assessment_type": "LMS Assignment"})]
			details = _dict({"email": "user1"})
			calculate_assessment_progress(assessments, details)
			self.assertEqual(details.average_assessments_progress, 0.0)

	# UT-UTILS-139
	def test_get_assessment_meta(self):
		""" Mapea correctamente el identificador de un módulo en su respectivo DocType para manejar sumisiones en el gestor LMS. """
		self.assertEqual(get_assessment_meta("LMS Assignment")[0], "LMS Assignment Submission")
		self.assertEqual(get_assessment_meta("LMS Quiz")[0], "LMS Quiz Submission")
		self.assertEqual(get_assessment_meta("LMS Programming Exercise")[0], "LMS Programming Exercise Submission")

	# UT-UTILS-140
	def test_has_submitted_assessment_not_attempted(self):
		""" Verifica que retorne 'Not Attempted' y 'Failed' si la evaluación no ha sido intentada. """
		with patch("lms.lms.utils.get_assessment_meta", return_value=("DocType", "field", ["status"], "Not Attempted")), \
			patch("frappe.db.exists", return_value=False), \
			patch("frappe.session", _dict({"user": "user1"})):
			result = has_submitted_assessment("a1", "LMS Assignment")
			self.assertEqual(result.status, "Not Attempted")
			self.assertEqual(result.result, "Failed")

	# UT-UTILS-141
	def test_has_submitted_assessment_attempted(self):
		""" Verifica que retorne el estado correcto si la evaluación ya fue enviada e intentada. """
		with patch("lms.lms.utils.get_assessment_meta", return_value=("DocType", "field", ["status"], "Not Attempted")), \
			patch("frappe.db.exists", return_value="sub1"), \
			patch("lms.lms.utils.get_assessment_attempt_details", return_value=_dict({"status": "Pass", "result": "Pass"})), \
			patch("frappe.session", _dict({"user": "user1"})):
			result = has_submitted_assessment("a1", "LMS Assignment")
			self.assertEqual(result.status, "Pass")

	# UT-UTILS-142
	def test_get_assessment_attempt_details_quiz_pass(self):
		""" Comprueba que evalúe como 'Pass' si el porcentaje obtenido es mayor o igual al requerido. """
		with patch("frappe.db.get_value", side_effect=[_dict({"percentage": 80, "name": "sub1"}), 50]):
			result = get_assessment_attempt_details("LMS Quiz Submission", {}, ["percentage"], "LMS Quiz", "quiz1")
			self.assertEqual(result.result, "Pass")
			self.assertEqual(result.status, 80)
			
	# UT-UTILS-143
	def test_get_assessment_attempt_details_quiz_fail(self):
		""" Comprueba que evalúe como 'Failed' si el porcentaje obtenido es menor al requerido. """
		with patch("frappe.db.get_value", side_effect=[_dict({"percentage": 30, "name": "sub1"}), 50]):
			result = get_assessment_attempt_details("LMS Quiz Submission", {}, ["percentage"], "LMS Quiz", "quiz1")
			self.assertEqual(result.result, "Failed")
			self.assertEqual(result.status, 30)

	# UT-UTILS-144
	def test_get_assessment_attempt_details_not_a_quiz(self):
		""" Valida que retorne el estado de sumisión tal cual cuando no se trata de un cuestionario (quiz). """
		with patch("frappe.db.get_value", return_value=_dict({"percentage": 1, "name": "sub1", "status": "Failed"})):
			result = get_assessment_attempt_details("LMS Quiz Submission", {}, ["percentage"], "No es Quiz", "no_quiz1")
			self.assertEqual(result.result, "Failed")
			self.assertEqual(result.status, "Failed")

	# UT-UTILS-145
	def test_can_access_topic_course_denied(self):
		""" Deniega el acceso a la discusión de una lección de curso si el usuario no tiene permisos ni inscripción. """
		with patch("frappe.db.get_value", return_value="course1"), \
			patch("frappe.db.exists", return_value=False), \
			patch("lms.lms.utils.can_modify_course", return_value=False), \
			patch("frappe.session", _dict({"user": "user1"})):
			self.assertFalse(can_access_topic("Course Lesson", "lesson1"))

	# UT-UTILS-146
	def test_can_access_topic_course_allowed(self):
		""" Permite el acceso a la discusión si el usuario cuenta con una inscripción activa en el curso. """
		with patch("frappe.db.get_value", return_value="course1"), \
			patch("frappe.db.exists", return_value=True), \
			patch("frappe.session", _dict({"user": "user1"})):
			self.assertTrue(can_access_topic("Course Lesson", "lesson1"))
	
	# UT-UTILS-147
	def test_can_access_topic_batch_denied(self):
		""" Deniega el acceso a un tema de lote (batch) si no existe matrícula ni permisos de edición. """
		with patch("frappe.db.exists", return_value=False), \
			patch("lms.lms.utils.can_modify_course", return_value=False), \
			patch("frappe.session", _dict({"user": "user1"})):
			self.assertFalse(can_access_topic("LMS Batch", "batch1"))

	# UT-UTILS-148
	def test_get_discussion_topics_denied(self):
		""" Lanza una excepción de validación al intentar obtener los temas de discusión sin el acceso permitido. """
		with patch("lms.lms.utils.can_access_topic", return_value=False):
			with self.assertRaises(frappe.exceptions.ValidationError):
				get_discussion_topics("Course Lesson", "lesson1")

	# UT-UTILS-149
	def test_get_discussion_topics_single_thread(self):
		""" Crea y retorna un tema de discusión único cuando se configura como hilo sencillo (single thread). """
		with patch("lms.lms.utils.can_access_topic", return_value=True), \
			patch("frappe.db.exists", return_value=False), \
			patch("lms.lms.utils.create_discussion_topic", return_value="topic1"):
			result = get_discussion_topics("Course Lesson", "lesson1", single_thread=True)
			self.assertEqual(result, "topic1")

	# UT-UTILS-150
	def test_get_discussion_topics_multiple_thread(self):
		""" Devuelve la lista de temas múltiples adjuntando el nombre del autor a cada uno. """
		with patch("lms.lms.utils.can_access_topic", return_value=True), \
			patch("frappe.get_all", return_value=[_dict({"name": "topic1", "title": "t1", "owner": "u1"})]), \
			patch("frappe.db.get_value", return_value="User Name"):
			result = get_discussion_topics("Course Lesson", "lesson1", single_thread=False)
			self.assertEqual(len(result), 1)
			self.assertEqual(result[0].user, "User Name")

	# UT-UTILS-151
	def test_get_discussion_topics_with_topic(self):
		""" Retorna un tema existente si se consulta en modo de hilo único y este ya se encuentra creado en base de datos. """
		with patch("lms.lms.utils.can_access_topic", return_value=True), \
			patch("frappe.db.exists", return_value=True), \
			patch("frappe.db.get_value", return_value=_dict({"name": "Topic 1"})):
			self.assertEqual(get_discussion_topics("Course Lesson", "lesson1", single_thread=True), {'name': 'Topic 1'})

	# UT-UTILS-152
	def test_get_discussion_replies(self):
		""" Obtiene las respuestas de una discusión incluyendo el nombre completo del autor validando accesos previos. """
		with patch("frappe.db.get_value", side_effect=[_dict({"reference_doctype": "Course Lesson", "reference_docname": "lesson1"}), _dict({"full_name": "User"})]), \
			patch("lms.lms.utils.can_access_topic", return_value=True), \
			patch("frappe.get_all", return_value=[_dict({"name": "r1", "owner": "u1", "reply": "reply"})]):
			result = get_discussion_replies("topic1")
			self.assertEqual(result[0].user.full_name, "User")

	# UT-UTILS-153
	def test_get_order_summary(self):
		""" Comprueba que el resumen de orden devuelva los montos originales y los formatos de moneda correctos. """
		with patch("lms.lms.utils.get_paid_course_details", return_value=_dict({"amount": 100, "currency": "USD", "amount_usd": 100})), \
			patch("lms.lms.utils.check_multicurrency", return_value=(100, "USD")), \
			patch("lms.lms.utils.fmt_money", return_value="$100"), \
			patch("lms.lms.utils.adjust_amount_for_coupon"), \
			patch("lms.lms.utils.get_gst_details"):
			result = get_order_summary("LMS Course", "course1")
			self.assertEqual(result.original_amount, 100)
			self.assertEqual(result.total_amount_formatted, "$100")

	# UT-UTILS-154
	def test_get_paid_course_details_free(self):
		""" Lanza una excepción si se intenta recuperar detalles de cobro sobre un curso parametrizado como gratuito. """
		with patch("frappe.db.get_value", return_value=_dict({"paid_course": 0, "paid_certificate": 0})):
			with self.assertRaises(frappe.exceptions.ValidationError):
				get_paid_course_details("course1")
				
	# UT-UTILS-155
	def test_get_paid_course_details_paid(self):
		""" Retorna los detalles de costo de manera satisfactoria al consultar un curso que sí es de pago. """
		with patch("frappe.db.get_value", return_value=_dict({"paid_course": 1, "amount": 100})):
			result = get_paid_course_details("course1")
			self.assertEqual(result.amount, 100)

	# UT-UTILS-156
	def test_apply_coupon_invalid(self):
		""" Lanza una excepción al intentar aplicar un cupón que no existe en el sistema. """
		with patch("frappe.db.exists", return_value=False):
			with self.assertRaises(frappe.exceptions.ValidationError):
				apply_coupon("LMS Course", "course1", "CODE10", 100)

	# UT-UTILS-157
	def test_apply_coupon_valid(self):
		""" Aplica correctamente el porcentaje de descuento y retorna el subtotal y el nombre interno del cupón. """
		with patch("frappe.db.exists", return_value="coupon1"), \
			patch("frappe.db.get_value", return_value=_dict({"discount_type": "Percentage", "percentage_discount": 10, "expires_on": None, "usage_limit": 0, "redemption_count": 0})), \
			patch("lms.lms.utils.validate_coupon_applicability"):
			discount, subtotal, name = apply_coupon("LMS Course", "course1", "CODE10", 100)
			self.assertEqual(discount, 10)
			self.assertEqual(subtotal, 90)
			self.assertEqual(name, "coupon1")

	# UT-UTILS-158
	def test_get_roles(self):
		""" Genera un diccionario consolidando los booleanos de los diferentes roles LMS asignados a un usuario. """
		with patch("lms.lms.utils.has_moderator_role", return_value=True), \
			patch("lms.lms.utils.has_course_instructor_role", return_value=False), \
			patch("lms.lms.utils.has_evaluator_role", return_value=False), \
			patch("lms.lms.utils.has_student_role", return_value=True):
			result = get_roles("user1")
			self.assertTrue(result["moderator"])
			self.assertTrue(result["lms_student"])
			self.assertFalse(result["course_creator"])

	# UT-UTILS-159
	def test_is_demo_course(self):
		""" Retorna True si el título del curso concuerda exactamente con el curso demostrativo predeterminado. """
		with patch("frappe.db.get_value", return_value="A guide to Frappe Learning"):
			self.assertTrue(is_demo_course("course1"))

	# UT-UTILS-160
	def test_is_demo_course_false(self):
		""" Retorna False si el título del curso no coincide con la guía interactiva por defecto. """
		with patch("frappe.db.get_value", return_value="Other"):
			self.assertFalse(is_demo_course("course1"))

	# UT-UTILS-161
	def test_validate_course_access_no_lesson(self):
		""" Arroja una excepción al verificar el acceso para una lección referenciada que no se halla en base de datos. """
		with patch("frappe.db.exists", return_value=False):
			with self.assertRaises(frappe.exceptions.ValidationError):
				validate_course_access("lesson1")

	# UT-UTILS-162
	def test_validate_course_access_no_enrollment(self):
		""" Falla la validación si el usuario no tiene ningún rol elevado y no cuenta con matrícula para el curso. """
		with patch("frappe.db.exists", side_effect=[True, False]), \
			patch("lms.lms.utils.has_moderator_role", return_value=False), \
			patch("lms.lms.utils.has_course_instructor_role", return_value=False), \
			patch("frappe.db.get_value", return_value="course1"), \
			patch("frappe.session", _dict({"user": "user1"})):
			with self.assertRaises(frappe.exceptions.ValidationError):
				validate_course_access("lesson1")
				
	# UT-UTILS-163
	def test_validate_course_access_enrolled(self):
		""" Autoriza silenciosamente el acceso si el usuario presenta un registro de membresía válido en el curso. """
		with patch("frappe.db.exists", side_effect=[True, True]), \
			patch("lms.lms.utils.has_moderator_role", return_value=False), \
			patch("lms.lms.utils.has_course_instructor_role", return_value=False), \
			patch("frappe.db.get_value", return_value="course1"), \
			patch("frappe.session", _dict({"user": "user1"})):
			self.assertIsNone(validate_course_access("lesson1"))

	# UT-UTILS-164
	def test_validate_course_access_moderator(self):
		""" Otorga libre acceso al contenido validando exclusivamente el rol privilegiado de moderador. """
		with patch("frappe.db.exists", return_value=True), \
			patch("lms.lms.utils.has_moderator_role", return_value=True):
			self.assertIsNone(validate_course_access("lesson1"))

	# UT-UTILS-165
	def test_validate_course_access_instructor(self):
		""" Otorga libre acceso al contenido validando el rol docente asociado al usuario. """
		with patch("frappe.db.exists", return_value=True), \
			patch("lms.lms.utils.has_moderator_role", return_value=False), \
			patch("lms.lms.utils.has_course_instructor_role", return_value=True):
			self.assertIsNone(validate_course_access("lesson1"))

	# UT-UTILS-166
	def test_has_lms_role(self):
		""" Devuelve False si los roles retornados por el sistema no intersecan con los roles del ecosistema LMS. """
		with patch("frappe.get_roles", return_value=["Some Role"]), \
			patch("lms.lms.utils.LMS_ROLES", ["System Manager", "Student"]):
			self.assertFalse(has_lms_role())

	# UT-UTILS-167
	def test_get_field_meta(self):
		""" Extrae y formatea en diccionario los atributos requeridos y de descripción de los campos de un DocType. """
		with patch("frappe.get_meta") as mock_get_meta:
			mock_meta_obj = MagicMock()
			mock_field = MagicMock(reqd=1, default="def", description="desc")
			mock_meta_obj.get_field.side_effect = lambda f: mock_field if f == "field1" else None
			mock_get_meta.return_value = mock_meta_obj
			result = get_field_meta("DocType", ["field1", "field2"])
			self.assertEqual(result["field1"]["reqd"], 1)
			self.assertNotIn("field2", result)

	# UT-UTILS-168
	def test_can_modify_course(self):
		""" Verifica que se puede modificar el curso si se superan las validaciones de existencia y control del usuario. """
		with patch("frappe.db.exists", return_value=True), \
			patch("frappe.session", _dict({"user": "user"})):
			self.assertTrue(can_modify_course("course1"))

	# UT-UTILS-169
	def test_can_modify_course_false(self):
		""" Rechaza permisos de modificación sobre el curso si el usuario no es el creador ni un moderador. """
		with patch("frappe.db.exists", return_value=False), \
			patch("lms.lms.utils.has_moderator_role", return_value=False), \
			patch("frappe.session", _dict({"user": "user"})):
			self.assertFalse(can_modify_course("course1"))

	# UT-UTILS-170
	def test_can_modify_batch(self):
		""" Verifica permisos para modificar un lote (batch) retornando True bajo autoría o permisos extendidos. """
		with patch("frappe.db.exists", return_value=True), \
			patch("frappe.session", _dict({"user": "user"})):
			self.assertTrue(can_modify_batch("batch1"))

	# UT-UTILS-171
	def test_can_modify_batch_false(self):
		""" Deniega permisos para editar un lote si se carece tanto de propiedad como del rol de moderación. """
		with patch("frappe.db.exists", return_value=False), \
			patch("lms.lms.utils.has_moderator_role", return_value=False), \
			patch("frappe.session", _dict({"user": "user"})):
			self.assertFalse(can_modify_batch("batch1"))

	# UT-UTILS-172
	def test_validate_batch_access_no_batch(self):
		""" Fuerza un error al intentar verificar el nivel de acceso en un identificador de lote inexistente. """
		with patch("frappe.db.exists", return_value=False):
			with self.assertRaises(frappe.exceptions.ValidationError):
				validate_batch_access("batch1")

	# UT-UTILS-173
	def test_validate_batch_access_enrolled(self):
		""" Valida satisfactoriamente la consulta de batch comprobando en DB la inscripción del estudiante a dicho lote. """
		with patch("frappe.db.exists", side_effect=[True, True]), \
			patch("lms.lms.utils.has_moderator_role", return_value=False), \
			patch("lms.lms.utils.has_evaluator_role", return_value=False), \
			patch("frappe.session", _dict({"user": "user"})):
			validate_batch_access("batch1")

	# UT-UTILS-174
	def test_validate_batch_access_moderator(self):
		""" Habilita el acceso directo al lote basándose puramente en la tenencia del perfil global de moderador. """
		with patch("frappe.db.exists", return_value=True), \
			patch("lms.lms.utils.has_moderator_role", return_value=True):
			self.assertIsNone(validate_batch_access("batch1"))

	# UT-UTILS-175
	def test_validate_batch_access_evaluator(self):
		""" Aprueba el ingreso al bloque validando que la cuenta posee los permisos de evaluador de sistema. """
		with patch("frappe.db.exists", return_value=True), \
			patch("lms.lms.utils.has_moderator_role", return_value=False), \
			patch("lms.lms.utils.has_evaluator_role", return_value=True):
			self.assertIsNone(validate_batch_access("batch1"))

	# UT-UTILS-176
	def test_validate_batch_access_not_enrolled(self):
		""" Detiene y levanta una excepción de validación al determinar la ausencia de matrículas y privilegios de edición. """
		with patch("lms.lms.utils.has_moderator_role", return_value=False), \
			patch("lms.lms.utils.has_evaluator_role", return_value=False), \
			patch("frappe.db.exists", side_effect=[True, False]), \
			patch("frappe.session", _dict({"user": "user1"})):
			with self.assertRaises(frappe.exceptions.ValidationError):
				validate_batch_access("batch1")

	# UT-UTILS-177
	def test_get_programs_guest(self):
		""" Lanza error al prohibir a perfiles invitados consultar la lista general de programas disponibles. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=False):
			with self.assertRaises(frappe.exceptions.ValidationError):
				get_programs()

	# UT-UTILS-178
	def test_get_programs(self):
		""" Obtiene y cruza programas inscritos contra programas públicos distribuyéndolos en listas de pertenencia. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.session", _dict({"user": "user@example.com"})), \
			patch("frappe.get_all", side_effect=[[_dict({"name": "p1", "progress": 50})], [_dict({"name": "p1"}), _dict({"name": "p2"})]]), \
			patch("frappe.db.get_value", return_value=_dict({"name": "p1", "course_count": 2, "member_count": 1})):
			result = get_programs()
			self.assertEqual(len(result["enrolled"]), 1)
			self.assertEqual(len(result["published"]), 1)
			self.assertEqual(result["published"][0].name, "p2")

	# UT-UTILS-179
	def test_get_program_details_guest(self):
		""" Asegura que los metadatos y currículum de un programa específico permanezcan ocultos al acceso invitado. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=False):
			with self.assertRaises(frappe.exceptions.ValidationError):
				get_program_details("Mi programa")

	# UT-UTILS-180
	def test_get_program_details_no_access(self):
		""" Exige inscripción activa para visualizar un programa que no cuenta con la bandera de publicación. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.db.get_value", return_value=False), \
			patch("frappe.db.exists", return_value=False), \
			patch("frappe.session", _dict({"user": "user1"})):
			with self.assertRaises(frappe.exceptions.ValidationError):
				get_program_details("Mi programa")

	# UT-UTILS-181
	def test_get_program_details(self):
		""" Extrae el desglose del programa recopilando porcentaje promediado e indicando eligibilidad individual de los cursos. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.db.get_value", side_effect=[True, _dict({"name": "Mi programa"}), 50]), \
			patch("frappe.db.exists", return_value=True), \
			patch("frappe.get_all", return_value=[_dict({"course": "Curso 1"})]), \
			patch("lms.lms.utils.get_course_details", side_effect=[_dict({"membership": _dict({"progress": 100})}), _dict({"membership": None})]), \
			patch("frappe.session", _dict({"user": "user1"})):
			result = get_program_details("Mi programa")
			self.assertEqual(result.name, "Mi programa")
			self.assertEqual(len(result.courses), 1)
			self.assertTrue(result.courses[0].eligible)
			self.assertEqual(result.progress, 50)

	# UT-UTILS-182
	def test_validate_program_enrollment_unpublished(self):
		""" Frena intentos de adhesión impidiendo las matrículas en programas que están en modo borrador/privado. """
		with patch("frappe.db.get_value", return_value=False):
			with self.assertRaises(frappe.exceptions.ValidationError):
				validate_program_enrollment("Mi programa")

	# UT-UTILS-183
	def test_validate_program_enrollment_published(self):
		""" Aprueba la habilitación para asociarse a un programa verificando su marca pública activa. """
		with patch("frappe.db.get_value", return_value=True):
			validate_program_enrollment("Mi programa")

	# UT-UTILS-184
	def test_enroll_in_program_new(self):
		""" Instancia un nuevo registro asociativo creando el documento base tras comprobar la carencia de suscripción previa. """
		with patch("lms.lms.utils.validate_program_enrollment"), \
			patch("frappe.db.exists", return_value=False), \
			patch("frappe.session", _dict({"user": "user1"})), \
			patch("frappe.new_doc") as mock_new_doc:
			mock_doc = MagicMock()
			mock_new_doc.return_value = mock_doc
			enroll_in_program("Mi programa")
			mock_doc.save.assert_called_once()

	# UT-UTILS-185
	def test_enroll_in_program_existing(self):
		""" Omite la transacción de escritura a BD si el estudiante ya cuenta con un registro dentro de la cohorte del programa. """
		with patch("lms.lms.utils.validate_program_enrollment"), \
			patch("frappe.db.exists", return_value=True), \
			patch("frappe.session", _dict({"user": "user1"})), \
			patch("frappe.new_doc") as mock_new_doc:
			enroll_in_program("Mi programa")
			mock_new_doc.assert_not_called()

	# UT-UTILS-186
	def test_get_paid_batch_details_free(self):
		""" Levanta una excepción forzando el abandono al solicitar las métricas económicas de un lote de carácter gratuito. """
		with patch("frappe.db.get_value", return_value=_dict({"paid_batch": 0})):
			with self.assertRaises(frappe.exceptions.ValidationError):
				get_paid_batch_details("b1")

	# UT-UTILS-187
	def test_get_paid_batch_details_paid(self):
		""" Acepta la solicitud comercial y expone el atributo numérico del costo del curso estipulado en la base. """
		with patch("frappe.db.get_value", return_value=_dict({"paid_batch": 1, "amount": 100})):
			result = get_paid_batch_details("b1")
			self.assertEqual(result.amount, 100)

	# UT-UTILS-188
	def test_adjust_amount_for_coupon_no_coupon(self):
		""" Retiene intactos los subtotales del resumen de facturación evadiendo cálculos cuando no se ingresan vales. """
		details = _dict({"amount": 100})
		adjust_amount_for_coupon(details, None, "DocType", "d1")
		self.assertEqual(details.amount, 100)

	# UT-UTILS-189
	def test_adjust_amount_for_coupon(self):
		""" Modifica el diccionario de costos insertándole el subtotal deducido y las llaves formateadas del descuento aplicado. """
		details = _dict({"amount": 100, "currency": "USD"})
		with patch("lms.lms.utils.apply_coupon", return_value=(10, 90, "coupon1")), \
			patch("lms.lms.utils.fmt_money", return_value="$10"):
			adjust_amount_for_coupon(details, "CODE", "DocType", "d1")
			self.assertEqual(details.amount, 90)
			self.assertEqual(details.discount_amount, 10)
			self.assertEqual(details.coupon, "coupon1")

	# UT-UTILS-190
	def test_get_gst_details_non_inr(self):
		""" Pasa de largo la fase del recargo en el caso de divisas y países donde la regla de impuesto GST es inaplicable. """
		details = _dict({"amount": 100, "currency": "USD"})
		get_gst_details(details, "US")
		self.assertNotIn("gst_applied", details)

	# UT-UTILS-191
	def test_get_gst_details_inr(self):
		""" Impacta el monto sumando tributos fijos de la región simulando una transacción para un usuario localizado en India. """
		details = _dict({"amount": 100, "currency": "INR"})
		with patch("lms.lms.utils.apply_gst", return_value=(118, 18)), \
			patch("lms.lms.utils.fmt_money", return_value="18 INR"):
			get_gst_details(details, "India")
			self.assertEqual(details.amount, 118)
			self.assertEqual(details.gst_applied, 18)

	# UT-UTILS-192
	def test_validate_coupon_expired(self):
		""" Frustra la utilización lanzando un error al comprobar que la fecha del servidor es mayor o igual que la de término. """
		with patch("lms.lms.utils.getdate", side_effect=["2022-01-01", "2023-01-01"]):
			with self.assertRaises(frappe.exceptions.ValidationError):
				validate_coupon("CODE", _dict({"expires_on": "2022-01-01", "usage_limit": 0, "redemption_count": 0}))

	# UT-UTILS-193
	def test_validate_coupon_usage_limit(self):
		""" Bloquea la redención forzando falla si el conteo actual de validaciones acumuladas colisiona con el techo de la promoción. """
		with patch("lms.lms.utils.getdate", return_value="2022-01-01"):
			with self.assertRaises(frappe.exceptions.ValidationError):
				validate_coupon("CODE", _dict({"expires_on": "2023-01-01", "usage_limit": 10, "redemption_count": 10}))

	# UT-UTILS-194
	def test_validate_coupon_valid(self):
		""" Atraviesa las barreras temporales y cuantitativas con éxito al simular límites saludables y fechas holgadas. """
		with patch("lms.lms.utils.getdate", return_value="2022-01-01"):
			validate_coupon("CODE", _dict({"expires_on": "2023-01-01", "usage_limit": 10, "redemption_count": 5}))

	# UT-UTILS-195
	def test_validate_coupon_applicability_invalid(self):
		""" Descarta el código si la revisión en la tabla paralela desvincula a la oferta promocional del producto cobrado. """
		with patch("frappe.db.exists", return_value=False):
			with self.assertRaises(frappe.exceptions.ValidationError):
				validate_coupon_applicability("LMS Course", "c1", "coupon1")

	# UT-UTILS-196
	def test_validate_coupon_applicability_valid(self):
		""" Autentica la relación de la tabla confirmando que el descuento estipulado está directamente configurado para el curso facturado. """
		with patch("frappe.db.exists", return_value=True):
			validate_coupon_applicability("LMS Course", "c1", "coupon1")

	# UT-UTILS-197
	def test_calculate_discount_amount_percentage(self):
		""" Realiza una rebaja tasada al extraer la métrica de descuento base (ej. 20%) aplicada al bruto alimentado de 100. """
		coupon = _dict({"discount_type": "Percentage", "percentage_discount": 20})
		self.assertEqual(calculate_discount_amount(100, coupon), 20)

	# UT-UTILS-198
	def test_calculate_discount_amount_fixed(self):
		""" Realiza una rebaja directa prestando un valor deducido monetariamente estático sin multiplicadores porcentuales. """
		coupon = _dict({"discount_type": "Fixed Amount", "fixed_amount_discount": 20})
		self.assertEqual(calculate_discount_amount(100, coupon), 80)

	# UT-UTILS-199
	def test_get_payment_doc(self):
		""" Asegura que se retorne el mismo archivo interno simulando la consulta por nombre estricto en la bóveda DB de pagos. """
		with patch("frappe.db.get_value", return_value=_dict({"name": "pay1"})):
			self.assertEqual(get_payment_doc("pay1").name, "pay1")

	# UT-UTILS-200
	def test_get_payment_id(self):
		""" Mapea y traduce las pasarelas estáticas hacia la clave que la API tercera dicta como variable de orden originaria. """
		self.assertEqual(get_payment_id({"payment_gateway": "Razorpay"}), "razorpay_payment_id")
		self.assertEqual(get_payment_id({"payment_gateway": "Stripe"}), "stripe_token_id")
		self.assertEqual(get_payment_id({"payment_gateway": "PayPal"}), "order_id")

	# UT-UTILS-201
	def test_update_coupon_redemption(self):
		""" Suma e inyecta artificialmente el conteo a 6, actualizando in-place el Documento LMS Coupon con `set_value`. """
		with patch("frappe.db.get_value", return_value=5), \
			patch("frappe.db.set_value") as mock_set:
			update_coupon_redemption(_dict({"coupon": "C1"}))
			mock_set.assert_called_once_with("LMS Coupon", "C1", "redemption_count", 6)

	# UT-UTILS-202
	def test_update_payment_details(self):
		""" Sobrescribe banderas internas y guarda el string serial del voucher de orden de compras para finalizar transacción. """
		with patch("lms.lms.utils.get_payment_id", return_value="order_id"), \
			patch("frappe.db.set_value") as mock_set:
			update_payment_details(_dict({"payment": "p1", "order_id": "123"}))
			mock_set.assert_called_once_with("LMS Payment", "p1", {"payment_received": 1, "payment_id": "123", "order_id": "123"})

	# UT-UTILS-203
	def test_get_integration_requests(self):
		""" Obtiene las solicitudes de integración para un documento y nombre específicos. """
		with patch("frappe.session", _dict({"user": "user1"})), \
			patch("frappe.get_all", return_value=[_dict({"data": "{}"})]):
			res = get_integration_requests("LMS Course", "c1")
			self.assertEqual(len(res), 1)

	# UT-UTILS-204
	def test_complete_enrollment_course(self):
		""" Completa la inscripción de un curso cuando no es un pago por certificado. """
		with patch("lms.lms.utils.get_payment_doc", return_value=_dict({"payment_for_certificate": 0, "coupon": None})), \
			patch("lms.lms.utils.update_coupon_redemption"), \
			patch("lms.lms.utils.enroll_in_course") as mock_enroll:
			complete_enrollment("pay1", "LMS Course", "c1")
			mock_enroll.assert_called_once_with("c1", "pay1")

	# UT-UTILS-205
	def test_complete_enrollment_batch(self):
		""" Completa la inscripción para un grupo (batch) específico. """
		with patch("lms.lms.utils.get_payment_doc", return_value=_dict({"payment_for_certificate": 0, "coupon": None})), \
			patch("lms.lms.utils.update_coupon_redemption"), \
			patch("lms.lms.utils.enroll_in_batch") as mock_enroll:
			complete_enrollment("pay1", "LMS Batch", "b1")
			mock_enroll.assert_called_once_with("b1", "pay1")

	# UT-UTILS-206
	def test_complete_enrollment_certificate(self):
		""" Completa la inscripción cuando el pago corresponde a la compra de un certificado. """
		with patch("lms.lms.utils.get_payment_doc", return_value=_dict({"payment_for_certificate": 1, "coupon": None})), \
			patch("lms.lms.utils.update_coupon_redemption"), \
			patch("lms.lms.utils.update_certificate_purchase") as mock_enroll:
			complete_enrollment("pay1", "LMS Course", "c1")
			mock_enroll.assert_called_once_with("c1", "pay1")

	# UT-UTILS-207
	def test_update_payment_record(self):
		""" Actualiza el registro de pago y completa la inscripción basada en la solicitud de integración. """
		with patch("lms.lms.utils.get_integration_requests", return_value=[_dict({"data": '{"payment": "pay1"}'})]), \
			patch("lms.lms.utils.update_payment_details") as mock_update, \
			patch("lms.lms.utils.complete_enrollment") as mock_complete:
			update_payment_record("LMS Course", "c1")
			mock_update.assert_called_once()
			mock_complete.assert_called_once()

	# UT-UTILS-208
	def test_enroll_in_course_new(self):
		""" Realiza una nueva inscripción en un curso si no existe una previa. """
		with patch("frappe.session", _dict({"user": "user1"})), \
			patch("frappe.db.exists", return_value=False), \
			patch("frappe.db.get_value", return_value=_dict({"name": "pay1", "source": "Stripe"})), \
			patch("frappe.new_doc") as mock_new:
			mock_doc = MagicMock()
			mock_new.return_value = mock_doc
			enroll_in_course("c1", "pay1")
			mock_doc.save.assert_called_once()

	# UT-UTILS-209
	def test_enroll_in_batch_missing(self):
		""" Lanza una excepción de validación si el grupo (batch) no existe al intentar inscribirse. """
		with patch("frappe.db.exists", return_value=False):
			with self.assertRaises(frappe.exceptions.ValidationError):
				enroll_in_batch("b1")

	# UT-UTILS-210
	def test_enroll_in_batch_valid(self):
		""" Inscribe de forma válida a un alumno en un grupo (batch) existente. """
		with patch("frappe.db.exists", return_value=True), \
			patch("lms.lms.utils.get_payment_details", return_value=_dict({"name": "p"})), \
			patch("lms.lms.utils.create_enrollment") as mock_create:
			enroll_in_batch("b1", "pay1")
			mock_create.assert_called_once()

	# UT-UTILS-211
	def test_get_payment_details(self):
		""" Obtiene los detalles de un pago o retorna None si el ID provisto es nulo. """
		with patch("frappe.db.get_value", return_value=_dict({"name": "pay1"})):
			self.assertEqual(get_payment_details("pay1").name, "pay1")
			self.assertIsNone(get_payment_details(None))

	# UT-UTILS-212
	def test_create_enrollment(self):
		""" Crea un documento de inscripción para un grupo con los detalles de pago suministrados. """
		with patch("frappe.session", _dict({"user": "u1"})), \
			patch("frappe.new_doc") as mock_new:
			mock_doc = MagicMock()
			mock_new.return_value = mock_doc
			create_enrollment("b1", _dict({"name": "pay1", "source": "Stripe"}))
			mock_doc.save.assert_called_once()

	# UT-UTILS-213
	def test_update_certificate_purchase(self):
		""" Actualiza el estado de compra del certificado para un usuario en una inscripción. """
		with patch("frappe.session", _dict({"user": "u1"})), \
			patch("frappe.db.set_value") as mock_set:
			update_certificate_purchase("c1", "pay1")
			mock_set.assert_called_once_with("LMS Enrollment", {"member": "u1", "course": "c1"}, {"purchased_certificate": 1, "payment": "pay1"})

	# UT-UTILS-214
	def test_get_batches_guest(self):
		""" Retorna una lista vacía de grupos si no se permite el acceso a invitados. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=False):
			self.assertEqual(get_batches(), [])

	# UT-UTILS-215
	def test_get_batches_without_filters(self):
		""" Obtiene la lista de grupos disponibles sin aplicar filtros adicionales. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.get_all", return_value=[_dict({"name": "batch 1"})]), \
			patch("lms.lms.utils.filter_batches_based_on_start_time", return_value=[_dict({"name": "batch 2"})]), \
			patch("lms.lms.utils.get_batch_card_details", return_value=[_dict({"name": "batch 3"})]):
			result = get_batches()
			self.assertEqual(len(result), 1)
			self.assertEqual(result[0].name, "batch 3")
	
	# UT-UTILS-216
	def test_get_batches_with_filters(self):
		""" Obtiene grupos aplicando un filtro específico como el estado de inscripción. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.session", _dict({"user": "u1"})), \
			patch("frappe.get_all", side_effect=[["b1"], [_dict({"name": "b1"})]]), \
			patch("lms.lms.utils.filter_batches_based_on_start_time", return_value=[_dict({"name": "b1"})]), \
			patch("lms.lms.utils.get_batch_card_details", return_value=[_dict({"name": "b1"})]):
			result = get_batches({"enrolled": True})
			self.assertEqual(len(result), 1)

	# UT-UTILS-217
	def test_get_batch_type(self):
		""" Determina si un grupo es próximo o archivado según las condiciones de su fecha de inicio. """
		self.assertEqual(get_batch_type({"start_date": [">", "2023"]}), "upcoming")
		self.assertEqual(get_batch_type({"start_date": ["<", "2023"]}), "archived")
		self.assertIsNone(get_batch_type({}))

	# UT-UTILS-218
	def test_filter_batches_based_on_start_time(self):
		""" Filtra grupos próximos comparando su hora de inicio con la hora actual del sistema. """
		with patch("lms.lms.utils.get_batch_type", return_value="upcoming"), \
			patch("lms.lms.utils.getdate", return_value="2023-01-01"), \
			patch("lms.lms.utils.nowtime", return_value="12:00:00"):
			batches = [_dict({"start_date": "2023-01-01", "start_time": "10:00:00"}), _dict({"start_date": "2023-01-01", "start_time": "13:00:00"})]
			result = filter_batches_based_on_start_time(batches, {})
			self.assertEqual(len(result), 1)
			self.assertEqual(result[0].start_time, "13:00:00")

	# UT-UTILS-219
	def test_filter_batches_based_on_start_time_archived(self):
		""" Filtra grupos archivados comparando su hora de inicio con la hora actual del sistema. """
		with patch("lms.lms.utils.get_batch_type", return_value="archived"), \
			patch("lms.lms.utils.getdate", return_value="2023-01-01"), \
			patch("lms.lms.utils.nowtime", return_value="12:00:00"):
			batches = [_dict({"start_date": "2023-01-01", "start_time": "10:00:00"}), _dict({"start_date": "2023-01-01", "start_time": "13:00:00"})]
			result = filter_batches_based_on_start_time(batches, {})
			self.assertEqual(len(result), 1)
			self.assertEqual(result[0].start_time, "10:00:00")

	# UT-UTILS-220
	def test_get_batch_card_details(self):
		""" Calcula y formatea los detalles de visualización de las tarjetas de los grupos. """
		with patch("lms.lms.utils.get_instructors", return_value=[]), \
			patch("frappe.db.count", return_value=5), \
			patch("lms.lms.utils.getdate", return_value="2023-01-01"), \
			patch("lms.lms.utils.check_multicurrency", return_value=(100, "USD")), \
			patch("lms.lms.utils.fmt_money", return_value="$100"):
			batches = [_dict({"name": "b1", "seat_count": 10, "paid_batch": 1, "start_date": "2023-02-01", "amount": 100, "currency": "USD", "amount_usd": 100})]
			result = get_batch_card_details(batches)
			self.assertEqual(result[0].seats_left, 5)
			self.assertEqual(result[0].price, "$100")

	# UT-UTILS-221
	def test_get_batch_student_details(self):
		""" Obtiene y formatea los datos de perfil y última actividad de un estudiante en el grupo. """
		with patch("frappe.db.get_value") as mock_get_value:
			mock_get_value.return_value=_dict({
				"full_name": "Alexander",
				"email": "user@gmil.com",
				"last_active": "2026-01-01"
			})
			result = get_batch_student_details("alex")
			self.assertEqual(result.full_name, "Alexander")
			self.assertEqual(result.email, "user@gmil.com")
			self.assertEqual(result.last_active, "01 Jan 26")

	# UT-UTILS-222
	def test_calculate_student_progress_empty(self):
		""" Asigna un progreso de cero si el estudiante no cuenta con cursos ni evaluaciones. """
		with patch("frappe.get_all", return_value=[]), \
			patch("lms.lms.utils.calculate_course_progress"), \
			patch("lms.lms.utils.calculate_assessment_progress"):
			details = _dict({})
			calculate_student_progress("b1", details)
			self.assertEqual(details.progress, 0)

	# UT-UTILS-223
	def test_calculate_student_progress_valid(self):
		""" Calcula el promedio combinado del progreso de cursos y evaluaciones de un estudiante. """
		with patch("frappe.get_all", side_effect=[["c1"], ["a1"]]), \
			patch("lms.lms.utils.calculate_course_progress"), \
			patch("lms.lms.utils.calculate_assessment_progress"):
			details = _dict({"average_course_progress": 100, "average_assessments_progress": 50})
			calculate_student_progress("b1", details)
			self.assertEqual(details.progress, 75.0)

	# UT-UTILS-224
	def test_create_discussion_topic(self):
		""" Inserta un nuevo tema de discusión vinculado a un documento específico. """
		with patch("frappe.new_doc") as mock_new:
			mock_doc = MagicMock()
			mock_new.return_value = mock_doc
			create_discussion_topic("DocType", "docname")
			mock_doc.insert.assert_called_once()

	# UT-UTILS-225
	def test_get_discussion_replies_denied(self):
		""" Lanza ValidationError si el usuario no cuenta con accesos permitidos al tema de discusión. """
		with patch("frappe.db.get_value", return_value=_dict({"reference_doctype": "Doc", "reference_docname": "d1"})), \
			patch("lms.lms.utils.can_access_topic", return_value=False):
			with self.assertRaises(frappe.exceptions.ValidationError):
				get_discussion_replies("t1")

	# UT-UTILS-226
	def test_get_lesson_creation_details(self):
		""" Obtiene la información estructural de títulos requerida al momento de crear una lección. """
		with patch("frappe.only_for"), \
			patch("frappe.db.get_value", side_effect=["ch1", "l1", _dict({"title": "L1"}), "Course", _dict({"title": "C1"})]):
			result = get_lesson_creation_details("c1", 1, 1)
			self.assertEqual(result["course_title"], "Course")
			self.assertEqual(result["lesson"].title, "L1")

	# UT-UTILS-227
	def test_publish_notifications(self):
		""" Publica notificaciones en tiempo real dirigidas a un usuario particular tras hacer commit. """
		with patch("frappe.publish_realtime") as mock_pub:
			publish_notifications(_dict({"for_user": "u1"}), "method")
			mock_pub.assert_called_once_with("publish_lms_notifications", user="u1", after_commit=True)

	# UT-UTILS-228
	def test_get_palette(self):
		""" Genera una paleta de colores de longitud fija a partir del nombre del usuario provisto. """
		self.assertEqual(len(get_palette("User Name")), 2)

	# UT-UTILS-229
	def test_get_related_courses_guest(self):
		""" Retorna una lista vacía de cursos relacionados si el usuario invitado no tiene permitido el acceso. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=False):
			self.assertEqual(get_related_courses("c1"), [])

	# UT-UTILS-230
	def test_get_related_courses(self):
		""" Retorna la lista de cursos relacionados cuando el acceso para invitados está habilitado. """
		with patch("lms.lms.utils.guest_access_allowed", return_value=True), \
			patch("frappe.get_all", return_value=["c2"]), \
			patch("lms.lms.utils.get_course_details", return_value=_dict({"name": "c2"})):
			result = get_related_courses("c1")
			self.assertEqual(result[0].name, "c2")

	# UT-UTILS-231
	def test_persona_captured(self):
		""" Registra en la configuración única del LMS que el perfil/persona del usuario ya fue guardado. """
		with patch("frappe.db.set_single_value") as mock_set:
			persona_captured()
			mock_set.assert_called_once_with("LMS Settings", "persona_captured", 1)

	# UT-UTILS-232
	def test_validate_discussion_reply_course(self):
		""" Valida los accesos a nivel de curso cuando se procesa una respuesta a un tema de lección. """
		with patch("frappe.db.get_value", return_value=_dict({"reference_doctype": "Course Lesson", "reference_docname": "l1"})), \
			patch("lms.lms.utils.validate_course_access") as mock_val:
			validate_discussion_reply(_dict({"topic": "t1"}), "m")
			mock_val.assert_called_once_with("l1")

	# UT-UTILS-233
	def test_validate_discussion_reply_batch(self):
		""" Valida los accesos a nivel de grupo (batch) cuando la respuesta pertenece a un foro de grupo. """
		with patch("frappe.db.get_value", return_value=_dict({"reference_doctype": "LMS Batch", "reference_docname": "batch1"})), \
			patch("lms.lms.utils.validate_batch_access") as mock_val:
			validate_discussion_reply(_dict({"topic": "t1"}), "m")
			mock_val.assert_called_once_with("batch1")

	# UT-UTILS-234
	def test_sanitize_json(self):
		""" Limpia y sanitiza estructuras JSON y cadenas HTML dentro de objetos complejos para prevenir inyecciones. """
		self.assertEqual(sanitize_json({"a": 1}), {"a": 1})
		self.assertEqual(sanitize_json([1, 2]), [1, 2])
		with patch("lms.lms.utils.sanitize_html", return_value="safe"):
			self.assertEqual(sanitize_json("<script>"), "safe")