# Copyright (c) 2022, Frappe and Contributors
# See license.txt

import frappe
from frappe.tests import UnitTestCase
from unittest.mock import patch, MagicMock
from frappe.utils import getdate, get_system_timezone

# Importamos la clase y las funciones globales que vamos a probar
from lms.lms.doctype.lms_certificate_request.lms_certificate_request import (
    LMSCertificateRequest,
    schedule_evals,
    setup_calendar_event,
    mark_eval_as_completed
)

class TestLMSCertificateRequest(UnitTestCase):
    
    def setUp(self):
        """Configuración inicial para cada prueba unitaria."""
        # Creamos una instancia básica del documento simulando los campos del DocType
        self.doc = frappe.get_doc({
            "doctype": "LMS Certificate Request",
            "name": "REQ-00001",
            "course": "Programación Básica",
            "course_title": "Programación Básica Avanzada",
            "batch_name": "Batch 2026",
            "member": "estudiante@ejemplo.com",
            "member_name": "Estudiante de Prueba",
            "evaluator": "evaluador@ejemplo.com",
            "evaluator_name": "Evaluador Senior",
            "date": "2026-06-15",
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "timezone": "",
            "status": "Upcoming"
        })

    @patch('lms.lms.doctype.lms_certificate_request.lms_certificate_request.get_evaluator')
    def test_set_evaluator_when_empty(self, mock_get_evaluator):
        """Prueba que el evaluador se asigne si no está definido."""
        self.doc.evaluator = None
        mock_get_evaluator.return_value = "evaluador_asignado@ejemplo.com"
        
        with patch('lms.lms.doctype.lms_certificate_request.lms_certificate_request.get_fullname', return_value="Evaluador Asignado"):
            self.doc.set_evaluator()
            self.assertEqual(self.doc.evaluator, "evaluador_asignado@ejemplo.com")
            self.assertEqual(self.doc.evaluator_name, "Evaluador Asignado")

    @patch('frappe.db.get_value')
    def test_validate_unavailability_throws_error(self, mock_get_value):
        """Prueba que lance error si el evaluador no está disponible en la fecha elegida."""
        mock_returns = MagicMock()
        mock_returns.unavailable_from = getdate("2026-06-10")
        mock_returns.unavailable_to = getdate("2026-06-20")
        mock_get_value.return_value = mock_returns

        self.doc.date = "2026-06-15"
        
        with self.assertRaises(frappe.ValidationError):
            self.doc.validate_unavailability()

    @patch('frappe.db.exists', return_value=True)
    def test_validate_slot_already_booked(self, mock_exists):
        """Prueba que lance error si el horario ya fue reservado por otro estudiante."""
        with self.assertRaises(frappe.ValidationError):
            self.doc.validate_slot()

    @patch('frappe.get_all')
    @patch('frappe.db.get_value', return_value="Curso Duplicado")
    def test_validate_if_existing_requests(self, mock_get_value, mock_get_all):
        """Prueba que lance error si el estudiante ya tiene solicitudes pendientes futuras."""
        mock_req = MagicMock()
        mock_req.date = getdate("2026-06-20")
        mock_req.start_time = "10:00:00"
        mock_req.course = "otro-curso"
        mock_get_all.return_value = [mock_req]

        with self.assertRaises(frappe.ValidationError):
            self.doc.validate_if_existing_requests()

    @patch('frappe.db.get_value')
    def test_validate_evaluation_end_date_exceeded(self, mock_get_value):
        """Prueba que lance error si la fecha supera el límite de evaluación del Batch."""
        mock_get_value.return_value = "2026-06-01" 
        self.doc.date = "2026-06-15"

        with self.assertRaises(frappe.ValidationError):
            self.doc.validate_evaluation_end_date()

    def test_validate_timezone_defaults_to_system(self):
        """Prueba que si no hay zona horaria se asigne la del sistema."""
        self.doc.timezone = None
        self.doc.validate_timezone()
        self.assertEqual(self.doc.timezone, get_system_timezone())

    @patch('frappe.get_cached_value', return_value="Default Email Account")
    @patch('frappe.sendmail')
    def test_send_notification(self, mock_sendmail, mock_cached_value):
        """Prueba que se intente enviar el correo de notificación tras la inserción."""
        self.doc.send_notification()
        self.assertTrue(mock_sendmail.called)

    @patch('frappe.db.get_single_value', return_value=True)
    @patch('frappe.get_all')
    @patch('lms.lms.doctype.lms_certificate_request.lms_certificate_request.setup_calendar_event')
    def test_schedule_evals_cron(self, mock_setup_calendar, mock_get_all, mock_get_single):
        """Prueba la función global que busca citas pendientes del calendario de Google."""
        mock_eval = MagicMock()
        mock_eval.name = "REQ-00001"
        mock_get_all.return_value = [mock_eval]

        schedule_evals()
        mock_setup_calendar.assert_called_once_with("REQ-00001")

    @patch('frappe.get_all')
    @patch('lms.lms.doctype.lms_certificate_request.lms_certificate_request.frappe.db.set_value')
    def test_mark_eval_as_completed(self, mock_set_value, mock_get_all):
        """Prueba que las evaluaciones cuya fecha ya pasó cambien a completadas automáticamente."""
        mock_req = MagicMock()
        mock_req.name = "REQ-OLD"
        mock_req.date = getdate("2026-01-01")
        mock_req.end_time = "10:00:00"
        mock_get_all.return_value = [mock_req]

        mark_eval_as_completed()
        mock_set_value.assert_called_with("LMS Certificate Request", "REQ-OLD", "status", "Completed")