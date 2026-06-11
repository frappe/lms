# Copyright (c) 2022, Frappe and Contributors
# See license.txt

import frappe
from frappe.tests import UnitTestCase
from frappe.utils import add_days, nowdate
from unittest.mock import patch, MagicMock
from datetime import timedelta

class TestLMSBatch(UnitTestCase):
	
	# UT-LMS-BATCH-001
	def test_on_update(self):
		""" Llama a enqueue para enviar notificación si se acaba de publicar el batch. """
		from lms.lms.doctype.lms_batch.lms_batch import send_notification_for_published_batch
		batch = frappe.new_doc("LMS Batch")
		batch.published = 1
		
		with patch.object(batch, "has_value_changed", return_value=True):
			with patch("frappe.enqueue") as mock_enqueue:
				batch.on_update()
				mock_enqueue.assert_called_once_with(send_notification_for_published_batch, batch=batch)

	# UT-LMS-BATCH-002
	def test_autoname(self):
		""" Genera un slug basado en el título si no tiene nombre; no hace nada si ya tiene nombre o falta el título. """
		batch = frappe.new_doc("LMS Batch")
		batch.title = "Test Title"
		batch.name = None
		
		with patch("lms.lms.doctype.lms_batch.lms_batch.generate_slug", return_value="test-title"):
			batch.autoname()
			self.assertEqual(batch.name, "test-title")
			
		# Cuando el nombre ya existe
		batch.name = "existing-name"
		with patch("lms.lms.doctype.lms_batch.lms_batch.generate_slug") as mock_generate_slug:
			batch.autoname()
			mock_generate_slug.assert_not_called()
			self.assertEqual(batch.name, "existing-name")
			
		# Cuando el título está vacío
		batch.name = None
		batch.title = ""
		with patch("lms.lms.doctype.lms_batch.lms_batch.generate_slug") as mock_generate_slug:
			batch.autoname()
			mock_generate_slug.assert_not_called()

	# UT-LMS-BATCH-003
	def test_validate_batch_end_date(self):
		""" Verifica que la fecha de fin no pueda ser anterior a la fecha de inicio. """
		batch = frappe.new_doc("LMS Batch")
		batch.start_date = add_days(nowdate(), 1)
		batch.end_date = nowdate()
		with self.assertRaises(frappe.exceptions.ValidationError):
			batch.validate_batch_end_date()

	# UT-LMS-BATCH-004
	def test_validate_batch_time(self):
		""" Valida que la hora de inicio no sea mayor o igual a la hora de fin. """
		batch = frappe.new_doc("LMS Batch")
		batch.start_time = "10:00:00"
		batch.end_time = "09:00:00"
		with self.assertRaises(frappe.exceptions.ValidationError):
			batch.validate_batch_time()

	# UT-LMS-BATCH-005
	def test_validate_duplicate_courses(self):
		""" Asegura que no se puedan añadir cursos duplicados al batch. """
		batch = frappe.new_doc("LMS Batch")
		batch.append("courses", {"course": "Test Course 1"})
		batch.append("courses", {"course": "Test Course 1"})
		with patch("frappe.db.get_value", return_value="Test Course 1"):
			with self.assertRaises(frappe.exceptions.ValidationError):
				batch.validate_duplicate_courses()

	# UT-LMS-BATCH-006
	def test_validate_payments_app(self):
		""" Lanza error en un batch de pago si la app 'payments' no está instalada. """
		batch = frappe.new_doc("LMS Batch")
		batch.paid_batch = 1
		with patch("frappe.get_installed_apps", return_value=["lms"]):
			with self.assertRaises(frappe.exceptions.ValidationError):
				batch.validate_payments_app()

	# UT-LMS-BATCH-007
	def test_validate_amount_and_currency(self):
		""" Lanza error en batch de pago si falta el monto o la moneda. """
		batch = frappe.new_doc("LMS Batch")
		batch.paid_batch = 1
		batch.amount = 0
		batch.currency = ""
		with self.assertRaises(frappe.exceptions.ValidationError):
			batch.validate_amount_and_currency()

	# UT-LMS-BATCH-008
	def test_validate_duplicate_assessments(self):
		""" Verifica que no se puedan duplicar las evaluaciones en el batch. """
		batch = frappe.new_doc("LMS Batch")
		batch.append("assessment", {"assessment_type": "LMS Quiz", "assessment_name": "Quiz 1"})
		batch.append("assessment", {"assessment_type": "LMS Quiz", "assessment_name": "Quiz 1"})
		with patch("frappe.db.get_value", return_value="Quiz 1 Title"):
			with self.assertRaises(frappe.exceptions.ValidationError):
				batch.validate_duplicate_assessments()

	# UT-LMS-BATCH-009
	def test_validate_evaluation_end_date(self):
		""" Lanza error si la fecha de fin de evaluación es anterior a la fecha de fin del batch. """
		batch = frappe.new_doc("LMS Batch")
		batch.end_date = add_days(nowdate(), 1)
		batch.evaluation_end_date = nowdate()
		with self.assertRaises(frappe.exceptions.ValidationError):
			batch.validate_evaluation_end_date()

	# UT-LMS-BATCH-010
	def test_validate_seats_left(self):
		""" Lanza error si los asientos son negativos o si se supera la cantidad máxima inscrita. """
		batch = frappe.new_doc("LMS Batch")
		batch.seat_count = -1
		with self.assertRaises(frappe.exceptions.ValidationError):
			batch.validate_seats_left()

		batch.name = "Test Batch"
		batch.seat_count = 1
		with patch("frappe.db.count", return_value=2):
			with self.assertRaises(frappe.exceptions.ValidationError):
				batch.validate_seats_left()

	# UT-LMS-BATCH-011
	def test_validate_timetable(self):
		""" Valida que los horarios y fechas de la tabla de tiempos estén dentro de los límites y sean lógicos. """
		batch = frappe.new_doc("LMS Batch")
		batch.start_date = nowdate()
		batch.end_date = add_days(nowdate(), 2)
		batch.start_time = "09:00:00"
		batch.end_time = "17:00:00"

		# Inicio >= Fin
		batch.set("timetable", [{"start_time": "10:00:00", "end_time": "09:00:00", "idx": 1, "date": add_days(nowdate(), 1)}])
		with self.assertRaises(frappe.exceptions.ValidationError):
			batch.validate_timetable()

		# Inicio fuera de la duración (antes)
		batch.set("timetable", [{"start_time": "08:00:00", "end_time": "10:00:00", "idx": 1, "date": add_days(nowdate(), 1)}])
		with self.assertRaises(frappe.exceptions.ValidationError):
			batch.validate_timetable()

		# Inicio fuera de la duración (después)
		batch.set("timetable", [{"start_time": "18:00:00", "end_time": "19:00:00", "idx": 1, "date": add_days(nowdate(), 1)}])
		with self.assertRaises(frappe.exceptions.ValidationError):
			batch.validate_timetable()

		# Fin fuera de la duración (después)
		batch.set("timetable", [{"start_time": "10:00:00", "end_time": "18:00:00", "idx": 1, "date": add_days(nowdate(), 1)}])
		with self.assertRaises(frappe.exceptions.ValidationError):
			batch.validate_timetable()

		# Fin fuera de la duración (antes)
		batch.set("timetable", [{"start_time": "09:00:00", "end_time": "08:30:00", "idx": 1, "date": add_days(nowdate(), 1)}])
		with self.assertRaises(frappe.exceptions.ValidationError):
			batch.validate_timetable()

		# Fecha fuera de la duración
		batch.set("timetable", [{"start_time": "10:00:00", "end_time": "11:00:00", "idx": 1, "date": add_days(nowdate(), 3)}])
		with self.assertRaises(frappe.exceptions.ValidationError):
			batch.validate_timetable()

		# Horario válido
		batch.set("timetable", [{"start_time": "10:00:00", "end_time": "11:00:00", "idx": 1, "date": add_days(nowdate(), 1)}])
		batch.validate_timetable() # No debería lanzar excepción

	# UT-LMS-BATCH-012
	def test_validate_conferencing_provider(self):
		""" Valida que la cuenta de Google Meet esté habilitada y tenga un calendario configurado. """
		batch = frappe.new_doc("LMS Batch")
		batch.conferencing_provider = "Google Meet"
		batch.google_meet_account = "Test Account"
		batch.is_new = MagicMock(return_value=False)

		# cuenta deshabilitada
		mock_settings = frappe._dict({"enabled": 0, "google_calendar": 1})
		with patch("frappe.get_doc", return_value=mock_settings):
			with self.assertRaises(frappe.exceptions.ValidationError):
				batch.validate_conferencing_provider()

		# sin calendario
		mock_settings.enabled = 1
		mock_settings.google_calendar = 0
		with patch("frappe.get_doc", return_value=mock_settings):
			with self.assertRaises(frappe.exceptions.ValidationError):
				batch.validate_conferencing_provider()

	# UT-LMS-BATCH-013
	def test_on_payment_authorized(self):
		""" Actualiza el registro de pago si el estado es autorizado o completado. """
		batch = frappe.new_doc("LMS Batch")
		batch.name = "Test Batch"

		with patch("lms.lms.doctype.lms_batch.lms_batch.update_payment_record") as mock_update:
			batch.on_payment_authorized("Authorized")
			mock_update.assert_called_once_with("LMS Batch", "Test Batch")

			mock_update.reset_mock()
			batch.on_payment_authorized("Completed")
			mock_update.assert_called_once_with("LMS Batch", "Test Batch")

			mock_update.reset_mock()
			batch.on_payment_authorized("Failed")
			mock_update.assert_not_called()

	# UT-LMS-BATCH-014
	def test_send_notification_for_published_batch(self):
		""" Envía una notificación (email o sistema) cuando se publica un batch. """
		from lms.lms.doctype.lms_batch.lms_batch import send_notification_for_published_batch
		batch = frappe.new_doc("LMS Batch")
		batch.published = 1
		batch.notification_sent = 0

		with patch("frappe.db.get_single_value", return_value=0):
			send_notification_for_published_batch(batch) # Retorna temprano

		with patch("frappe.db.get_single_value", return_value="Email"):
			with patch("lms.lms.doctype.lms_batch.lms_batch.send_email_notification_for_published_batch") as mock_email:
				send_notification_for_published_batch(batch)
				mock_email.assert_called_once_with(batch)

		with patch("frappe.db.get_single_value", return_value="System"):
			with patch("lms.lms.doctype.lms_batch.lms_batch.send_system_notification_for_published_batch") as mock_system:
				send_notification_for_published_batch(batch)
				mock_system.assert_called_once_with(batch)

		# Retorna temprano si no está publicado
		batch.published = 0
		with patch("frappe.db.get_single_value", return_value="Email"):
			with patch("lms.lms.doctype.lms_batch.lms_batch.send_email_notification_for_published_batch") as mock_email:
				send_notification_for_published_batch(batch)
				mock_email.assert_not_called()

		# Retorna temprano si la notificación ya fue enviada
		batch.published = 1
		batch.notification_sent = 1
		with patch("frappe.db.get_single_value", return_value="Email"):
			with patch("lms.lms.doctype.lms_batch.lms_batch.send_email_notification_for_published_batch") as mock_email:
				send_notification_for_published_batch(batch)
				mock_email.assert_not_called()

	# UT-LMS-BATCH-015
	def test_send_email_notification_for_published_batch(self):
		""" Envía un correo electrónico a instructores y alumnos cuando se publica el batch. """
		from lms.lms.doctype.lms_batch.lms_batch import send_email_notification_for_published_batch
		batch = frappe.new_doc("LMS Batch")
		batch.name = "test-batch"
		batch.title = "Test Batch"
		batch.description = "Test Desc"
		batch.start_date = "2023-01-01"
		batch.end_date = "2023-01-31"
		batch.start_time = "10:00:00"
		batch.medium = "English"
		batch.timezone = "UTC"

		with patch("frappe.db.get_single_value", side_effect=["Brand", "logo.png"]), \
			 patch("frappe.get_all", return_value=["student@example.com"]), \
			 patch("lms.lms.doctype.lms_batch.lms_batch.get_instructors", return_value=["instructor@example.com"]), \
			 patch("frappe.sendmail") as mock_sendmail, \
			 patch("frappe.db.set_value") as mock_set_value:

			 send_email_notification_for_published_batch(batch)

			 mock_sendmail.assert_called_once()
			 args, kwargs = mock_sendmail.call_args
			 self.assertEqual(kwargs['recipients'], ["instructor@example.com"])
			 self.assertEqual(kwargs['bcc'], ["student@example.com"])
			 mock_set_value.assert_called_once_with("LMS Batch", "test-batch", "notification_sent", 1)

	# UT-LMS-BATCH-016
	def test_send_system_notification_for_published_batch(self):
		""" Genera un registro de notificación en el sistema al publicarse el batch. """
		from lms.lms.doctype.lms_batch.lms_batch import send_system_notification_for_published_batch
		batch = frappe.new_doc("LMS Batch")
		batch.name = "test-batch"
		batch.title = "Test Batch"

		with patch("frappe.get_all", side_effect=[["student1"], ["instructor1"]]), \
			 patch("frappe.db.get_value", return_value="Instructor Name"), \
			 patch("lms.lms.doctype.lms_batch.lms_batch.make_notification_logs") as mock_make_logs, \
			 patch("frappe.db.set_value") as mock_set_value:

			 send_system_notification_for_published_batch(batch)

			 mock_make_logs.assert_called_once()
			 args, kwargs = mock_make_logs.call_args
			 self.assertEqual(args[1], ["student1"])
			 self.assertEqual(args[0]["document_name"], "test-batch")
			 self.assertEqual(args[0]["from_user"], "instructor1")
			 mock_set_value.assert_called_once_with("LMS Batch", "test-batch", "notification_sent", 1)

	# UT-LMS-BATCH-017
	def test_create_live_class(self):
		""" Crea una clase en vivo mediante la API de Zoom comprobando que el usuario tenga permisos. """
		from lms.lms.doctype.lms_batch.lms_batch import create_live_class

		with patch("frappe.get_roles", return_value=["Moderator"]), \
			 patch("lms.lms.doctype.lms_batch.lms_batch.authenticate", return_value="token"), \
			 patch("requests.post") as mock_post, \
			 patch("frappe.get_doc") as mock_get_doc, \
			 patch("frappe.session", MagicMock(user="test_user")):

			 # Escenario de éxito
			 mock_response = MagicMock()
			 mock_response.status_code = 201
			 mock_response.text = '{"start_url": "surl", "join_url": "jurl", "id": "123", "uuid": "u123", "password": "pwd"}'
			 mock_post.return_value = mock_response

			 mock_doc = MagicMock()
			 mock_get_doc.return_value = mock_doc

			 res = create_live_class(
				 batch_name="Test Batch", zoom_account="Test Zoom", title="Live Class",
				 duration=60, date="2023-01-01", time="10:00:00", timezone="UTC",
				 auto_recording="No Recording", description="Desc"
			 )

			 self.assertEqual(res, mock_doc)
			 mock_doc.save.assert_called_once()

			 # Escenario de falla
			 mock_response.status_code = 400
			 mock_response.text = 'Error'
			 with self.assertRaises(frappe.exceptions.ValidationError):
				 create_live_class(
					 batch_name="Test Batch", zoom_account="Test Zoom", title="Live Class",
					 duration=60, date="2023-01-01", time="10:00:00", timezone="UTC",
					 auto_recording="No Recording", description="Desc"
				 )

		# Sin permisos
		with patch("frappe.get_roles", return_value=["Student"]):
			with self.assertRaises(frappe.exceptions.ValidationError):
				create_live_class(
					 batch_name="Test Batch", zoom_account="Test Zoom", title="Live Class",
					 duration=60, date="2023-01-01", time="10:00:00", timezone="UTC",
					 auto_recording="No Recording", description="Desc"
				 )

	# UT-LMS-BATCH-018
	def test_create_google_meet_live_class(self):
		""" Crea un documento de clase en vivo para Google Meet y valida la configuración. """
		from lms.lms.doctype.lms_batch.lms_batch import create_google_meet_live_class

		mock_settings = frappe._dict({"enabled": 1, "google_calendar": 1})
		with patch("frappe.only_for"), \
			 patch("frappe.get_doc") as mock_get_doc, \
			 patch("frappe.session", MagicMock(user="test_user")):

			 def get_doc_side_effect(doctype, *args, **kwargs):
				 if doctype == "LMS Google Meet Settings":
					 return mock_settings
				 else:
					 doc = MagicMock()
					 return doc

			 mock_get_doc.side_effect = get_doc_side_effect

			 res = create_google_meet_live_class(
				 batch_name="Test Batch", google_meet_account="Test Meet", title="Live Class",
				 duration=60, date="2023-01-01", time="10:00:00", timezone="UTC"
			 )
			 res.save.assert_called_once()

	# UT-LMS-BATCH-019
	def test_authenticate(self):
		""" Autentica en Zoom obteniendo un access_token y valida si la cuenta está habilitada. """
		from lms.lms.doctype.lms_batch.lms_batch import authenticate

		mock_zoom = MagicMock()
		mock_zoom.enabled = 1
		mock_zoom.account_id = "acc123"
		mock_zoom.client_id = "client123"
		mock_zoom.get_password.return_value = "secret123"

		mock_response = MagicMock()
		mock_response.json.return_value = {"access_token": "token123"}

		with patch("frappe.get_doc", return_value=mock_zoom), \
			 patch("requests.request", return_value=mock_response):

			 token = authenticate("Test Zoom Account")
			 self.assertEqual(token, "token123")

		# No habilitado
		mock_zoom.enabled = 0
		with patch("frappe.get_doc", return_value=mock_zoom):
			with self.assertRaises(frappe.exceptions.ValidationError):
				authenticate("Test Zoom Account")

	# UT-LMS-BATCH-020
	def test_get_batch_timetable(self):
		""" Obtiene el horario del batch validando los roles del usuario. """
		from lms.lms.doctype.lms_batch.lms_batch import get_batch_timetable

		# Probar verificaciones de permisos
		with patch("frappe.get_roles", return_value=["Moderator"]), \
			 patch("frappe.db.exists", return_value=False), \
			 patch("frappe.get_all", return_value=[frappe._dict({"name": "entry1", "reference_doctype": "Doc", "reference_docname": "Doc1", "date": "2023-01-01"})]), \
			 patch("frappe.db.get_value", return_value=0), \
			 patch("lms.lms.doctype.lms_batch.lms_batch.get_timetable_details", return_value=[{"name": "entry1"}]), \
			 patch("frappe.session", MagicMock(user="test_user")):

			 timetable = get_batch_timetable("Test Batch")
			 self.assertEqual(timetable, [{"name": "entry1"}])

		# Sin permisos
		with patch("frappe.get_roles", return_value=["Student"]), \
			 patch("frappe.db.exists", return_value=False), \
			 patch("frappe.session", MagicMock(user="test_user")):
			 with self.assertRaises(frappe.PermissionError):
				 get_batch_timetable("Test Batch")

		# Con clases en vivo
		with patch("frappe.get_roles", return_value=["Moderator"]), \
			 patch("frappe.db.exists", return_value=False), \
			 patch("frappe.get_all", return_value=[]), \
			 patch("frappe.db.get_value", return_value=1), \
			 patch("lms.lms.doctype.lms_batch.lms_batch.get_live_classes", return_value=[{"name": "live1", "reference_doctype": "LMS Live Class", "reference_docname": "live1", "date": "2023-01-02"}]), \
			 patch("lms.lms.doctype.lms_batch.lms_batch.get_timetable_details", return_value=[{"name": "live1"}]), \
			 patch("frappe.session", MagicMock(user="test_user")):

			 timetable = get_batch_timetable("Test Batch")
			 self.assertEqual(timetable, [{"name": "live1"}])

	# UT-LMS-BATCH-021
	def test_get_live_classes(self):
		""" Obtiene y formatea las clases en vivo para presentarlas en el horario. """
		from lms.lms.doctype.lms_batch.lms_batch import get_live_classes

		mock_class = frappe._dict({
			"name": "Live Class 1",
			"title": "Live Title",
			"date": "2023-01-01",
			"start_time": timedelta(hours=10),
			"duration": 60,
			"url": "url"
		})

		with patch("frappe.get_all", return_value=[mock_class]):
			res = get_live_classes("Test Batch")
			self.assertEqual(len(res), 1)
			self.assertEqual(res[0].end_time, timedelta(hours=11))
			self.assertEqual(res[0].reference_doctype, "LMS Live Class")
			self.assertEqual(res[0].icon, "icon-call")

	# UT-LMS-BATCH-022
	def test_get_timetable_details(self):
		""" Detalla y ordena los eventos del horario (lecciones, quizes, asignaciones). """
		from lms.lms.doctype.lms_batch.lms_batch import get_timetable_details

		timetable = [
			frappe._dict({"reference_doctype": "Course Lesson", "reference_docname": "Lesson 1", "date": "2023-01-02"}),
			frappe._dict({"reference_doctype": "LMS Quiz", "reference_docname": "Quiz 1", "date": "2023-01-01"}),
			frappe._dict({"reference_doctype": "LMS Assignment", "reference_docname": "Assignment 1", "date": "2023-01-03"})
		]

		with patch("frappe.db.get_value", side_effect=["Title 1", "Course 1", "Title 2", "Title 3"]), \
			 patch("lms.lms.doctype.lms_batch.lms_batch.get_lesson_url", return_value="lesson_url"), \
			 patch("lms.lms.doctype.lms_batch.lms_batch.get_lesson_index", return_value=1), \
			 patch("frappe.db.exists", return_value=True), \
			 patch("lms.lms.doctype.lms_batch.lms_batch.get_quiz_details", return_value={"quiz": "data"}), \
			 patch("lms.lms.doctype.lms_batch.lms_batch.get_assignment_details", return_value={"assignment": "data"}), \
			 patch("frappe.session", MagicMock(user="test_user")):

			 res = get_timetable_details(timetable)

			 self.assertEqual(len(res), 3)
			 self.assertEqual(res[0].date, "2023-01-01") # Ordenado por fecha
			 self.assertEqual(res[0].reference_doctype, "LMS Quiz")
			 self.assertEqual(res[0].quiz, "data")

			 self.assertEqual(res[1].reference_doctype, "Course Lesson")
			 self.assertTrue(res[1].completed)

			 self.assertEqual(res[2].reference_doctype, "LMS Assignment")
			 self.assertEqual(res[2].assignment, "data")

	# UT-LMS-BATCH-023
	def test_send_batch_start_reminder(self):
		""" Envía un recordatorio a los estudiantes sobre el inicio del batch el día siguiente. """
		from lms.lms.doctype.lms_batch.lms_batch import send_batch_start_reminder

		mock_batch = frappe._dict({"name": "b1", "title": "B1", "start_date": "2023-01-01", "start_time": "10:00:00", "medium": "Eng"})
		mock_student = frappe._dict({"member": "student1@test.com", "member_name": "Student 1"})

		with patch("frappe.get_all", side_effect=[[mock_batch], [mock_student]]), \
			 patch("lms.lms.doctype.lms_batch.lms_batch.send_mail") as mock_send_mail, \
             patch("lms.lms.doctype.lms_batch.lms_batch.nowdate", return_value="2023-01-01"), \
             patch("lms.lms.doctype.lms_batch.lms_batch.add_days", return_value="2023-01-02"):

			 send_batch_start_reminder()
			 mock_send_mail.assert_called_once_with(mock_batch, mock_student)

	# UT-LMS-BATCH-024
	def test_send_mail(self):
		""" Envoltorio para frappe.sendmail destinado al recordatorio de inicio. """
		from lms.lms.doctype.lms_batch.lms_batch import send_mail
		mock_batch = frappe._dict({"name": "b1", "title": "B1", "start_date": "2023-01-01", "start_time": "10:00:00", "medium": "Eng"})
		mock_student = frappe._dict({"member": "student1@test.com", "member_name": "Student 1"})

		with patch("frappe.sendmail") as mock_sendmail:
			send_mail(mock_batch, mock_student)
			mock_sendmail.assert_called_once()
			args, kwargs = mock_sendmail.call_args
			self.assertEqual(kwargs['recipients'], "student1@test.com")

	# UT-LMS-BATCH-025
	def test_has_permission(self):
		""" Evalúa permisos de acceso al documento en función de roles y configuración de batch. """
		from lms.lms.doctype.lms_batch.lms_batch import has_permission

		mock_doc = frappe._dict({"name": "Test Batch"})

		# Usuario Invitado permitido
		with patch("lms.lms.doctype.lms_batch.lms_batch.guest_access_allowed", return_value=True):
			with patch("frappe.get_roles", return_value=["Guest"]):
				with patch("frappe.db.exists", return_value=True):
					self.assertTrue(has_permission(mock_doc, user="Guest"))

		# Usuario Invitado no permitido
		with patch("lms.lms.doctype.lms_batch.lms_batch.guest_access_allowed", return_value=False):
			self.assertFalse(has_permission(mock_doc, user="Guest"))

		# Usuario Administrador
		with patch("frappe.get_roles", return_value=["Moderator"]):
			self.assertTrue(has_permission(mock_doc, user="Admin"))

		# Tipo de permiso (ptype) inválido
		with patch("frappe.get_roles", return_value=["Student"]):
			self.assertFalse(has_permission(mock_doc, ptype="write", user="Student"))

		# Usuario inscrito
		with patch("frappe.get_roles", return_value=["Student"]):
			with patch("frappe.db.exists", return_value=True):
				self.assertTrue(has_permission(mock_doc, user="Student"))

		# No inscrito, pero el batch está publicado
		with patch("frappe.get_roles", return_value=["Student"]):
			with patch("frappe.db.exists", return_value=False):
				with patch("frappe.db.get_value", return_value=1): # publicado
					self.assertTrue(has_permission(mock_doc, user="Student"))

		# No inscrito, batch no publicado
		with patch("frappe.get_roles", return_value=["Student"]):
			with patch("frappe.db.exists", return_value=False):
				with patch("frappe.db.get_value", return_value=0): # no publicado
					self.assertFalse(has_permission(mock_doc, user="Student"))
