# Copyright (c) 2021, Frappe and Contributors  
# See license.txt  
  
from unittest.mock import MagicMock, patch  
  
import frappe  
from frappe.tests import UnitTestCase  
  
from lms.lms.doctype.lms_assignment_submission.lms_assignment_submission import (  
    LMSAssignmentSubmission,  
)  
  
_MODULE = "lms.lms.doctype.lms_assignment_submission.lms_assignment_submission"  
  
class TestLMSAssignmentSubmission(UnitTestCase):  
	def setUp(self):
		self.doc = MagicMock(spec=LMSAssignmentSubmission)
		self.doc.assignment = "ASSIGN-001"
		self.doc.member = "user@example.com"
		self.doc.name = "SUB-001"
		self.doc.lesson = "LESSON-001"
		self.doc.member_name = "Test User"
	
	def _create_img(self, src):  
		"""Crea un mock de Tag de BeautifulSoup con src configurable."""  
		img = MagicMock()  
		img.get.return_value = src  
		return img  
	
	# UT-LMS-ASSUB-001
	def test_validate_calls_all_methods(self):
		"""validate() llama a los tres métodos de validación."""
		LMSAssignmentSubmission.validate(self.doc)
		self.doc.validate_duplicates.assert_called_once()
		self.doc.validate_url.assert_called_once()
		self.doc.validate_status.assert_called_once()

	# UT-LMS-ASSUB-002
	def test_on_update_calls_validate_private_attachments(self):
		"""on_update() llama a validate_private_attachments()."""
		LMSAssignmentSubmission.on_update(self.doc)
		self.doc.validate_private_attachments.assert_called_once()
  
	# UT-LMS-ASSUB-003
	def test_no_duplicate_no_throw(self):  
		"""Sin duplicado, no lanza excepción."""  
		with patch("frappe.db.exists", return_value=False):  
			LMSAssignmentSubmission.validate_duplicates(self.doc)

	# UT-LMS-ASSUB-004
	def test_duplicate_exists_throws(self):  
		"""Duplicado existe, obtiene título de lección y lanza ValidationError."""  
		with patch("frappe.db.exists", return_value=True):  
			with patch("frappe.db.get_value", return_value="Introduction to Python"):  
				with self.assertRaises(frappe.ValidationError):  
					LMSAssignmentSubmission.validate_duplicates(self.doc)  

	# UT-LMS-ASSUB-005
	def test_validate_url_type_not_url_skips(self):  
		"""type != 'URL', validate_url no es llamado, no lanza excepción."""  
		self.doc.type = "Text"  

		with patch(f"{_MODULE}.validate_url") as mock_validate_url:  
			LMSAssignmentSubmission.validate_url(self.doc)  
			mock_validate_url.assert_not_called()  

	# UT-LMS-ASSUB-006
	def test_validate_url_type_url_valid(self):  
		"""type == 'URL', URL válida, no lanza excepción."""  
		self.doc.type = "URL"  
		self.doc.answer = "https://example.com"  

		with patch(f"{_MODULE}.validate_url", return_value=True):  
			LMSAssignmentSubmission.validate_url(self.doc) 

	# UT-LMS-ASSUB-007
	def test_validate_url_type_url_invalid_throws(self):  
		"""type == 'URL', URL inválida, lanza ValidationError."""  
		self.doc.type = "URL"  
		self.doc.answer = "url-invalido"  

		with patch(f"{_MODULE}.validate_url", return_value=False):  
			with self.assertRaises(frappe.ValidationError):  
				LMSAssignmentSubmission.validate_url(self.doc)  

	# UT-LMS-ASSUB-008
	def test_is_new_skips_notification(self):  
		"""is_new() True, no llama trigger_update_notification."""  
		self.doc.is_new.return_value = True  
		LMSAssignmentSubmission.validate_status(self.doc)  
		self.doc.trigger_update_notification.assert_not_called()  

	# UT-LMS-ASSUB-009
	def test_status_changed_triggers_notification(self):  
		"""is_new() False, status cambia, llama trigger_update_notification."""  
		self.doc.is_new.return_value = False  
		self.doc.status = "Graded"  
		self.doc.comments = "El mismo comentario"  

		doc_before = MagicMock()  
		doc_before.status = "Pending"  
		doc_before.comments = "El mismo comentario"  
		self.doc.get_doc_before_save.return_value = doc_before  

		LMSAssignmentSubmission.validate_status(self.doc)  
		self.doc.trigger_update_notification.assert_called_once()   

	# UT-LMS-ASSUB-010
	def test_neither_status_nor_comments_changed_no_notification(self):  
		"""is_new() False, ni status ni comments cambian, no llama trigger_update_notification."""  
		self.doc.is_new.return_value = False  
		self.doc.status = "Pending"  
		self.doc.comments = "El mismo comentario"  

		doc_before = MagicMock()  
		doc_before.status = "Pending"  
		doc_before.comments = "El mismo comentario"  
		self.doc.get_doc_before_save.return_value = doc_before  

		LMSAssignmentSubmission.validate_status(self.doc)  
		self.doc.trigger_update_notification.assert_not_called()  

	# UT-LMS-ASSUB-011
	def test_type_not_text_skips_parsing(self):  
		"""type != 'Text', attach_images_to_document no es llamado."""  
		self.doc.type = "URL"  

		LMSAssignmentSubmission.validate_private_attachments(self.doc)  
		self.doc.attach_images_to_document.assert_not_called()  

	# UT-LMS-ASSUB-012
	def test_type_text_with_image_calls_attach(self):  
		"""type == 'Text', HTML con img, parsea y llama attach_images_to_document con 1 imagen."""  
		self.doc.type = "Text"  
		self.doc.answer = '<p>Hola</p><img src="/aws/files/test.png">'  

		LMSAssignmentSubmission.validate_private_attachments(self.doc)  

		self.doc.attach_images_to_document.assert_called_once()  
		images_arg = self.doc.attach_images_to_document.call_args[0][0]  
		self.assertEqual(len(images_arg), 1)  

	# UT-LMS-ASSUB-013
	def test_type_text_without_images_calls_attach_with_empty_list(self):  
		"""type == 'Text', HTML sin img, llama attach_images_to_document con lista vacía."""  
		self.doc.type = "Text"  
		self.doc.answer = "<p>No hay imagenes</p>"  

		LMSAssignmentSubmission.validate_private_attachments(self.doc)  

		self.doc.attach_images_to_document.assert_called_once()  
		images_arg = self.doc.attach_images_to_document.call_args[0][0]  
		self.assertEqual(len(images_arg), 0)  

	# UT-LMS-ASSUB-014
	def test_empty_images_list_no_db_call(self):  
		"""Lista vacía, frappe.db.get_value nunca es llamado."""  

		with patch("frappe.db.get_value") as mock_get_value:  
			LMSAssignmentSubmission.attach_images_to_document(self.doc, [])  
			mock_get_value.assert_not_called()  

	# UT-LMS-ASSUB-015
	def test_image_with_non_private_src_no_db_call(self):  
		"""src no empieza con /private/files/, frappe.db.get_value no es llamado."""  
		img = self._create_img("https://aws.com/image.png")  

		with patch("frappe.db.get_value") as mock_get_value:  
			LMSAssignmentSubmission.attach_images_to_document(self.doc, [img])  
			mock_get_value.assert_not_called()  

	# UT-LMS-ASSUB-016
	def test_private_image_file_found_calls_set_value(self):  
		"""src empieza con /private/files/, file encontrado, frappe.db.set_value llamado con campos correctos."""  
		self.doc.doctype = "LMS Assignment Submission"  
		self.doc.name = "SUB-001"  
		img = self._create_img("/private/files/test.png")  

		with patch("frappe.db.get_value", return_value="FILE-001"):  
			with patch("frappe.db.set_value") as mock_set_value:  
				LMSAssignmentSubmission.attach_images_to_document(self.doc, [img])  
				mock_set_value.assert_called_once_with(  
					"File",  
					"FILE-001",  
					{  
						"attached_to_doctype": "LMS Assignment Submission",  
						"attached_to_name": "SUB-001",  
						"attached_to_field": "answer",  
					},  
				)  

	# UT-LMS-ASSUB-017
	def test_private_image_file_not_found_no_set_value(self):  
		"""src empieza con /private/files/, file NO encontrado, frappe.db.set_value no es llamado."""  
		img = self._create_img("/private/files/missing.png")  

		with patch("frappe.db.get_value", return_value=None):  
			with patch("frappe.db.set_value") as mock_set_value:  
				LMSAssignmentSubmission.attach_images_to_document(self.doc, [img])  
				mock_set_value.assert_not_called()

	# UT-LMS-ASSUB-018
	def test_builds_notification_and_calls_make_notification_logs(self):  
		"""Construye el dict de notificación correctamente y llama make_notification_logs."""  
		self.doc.assignment_title = "Python Basico"  
		self.doc.comments = "Buen trabajo!"  
		self.doc.doctype = "LMS Assignment Submission"  
		self.doc.name = "SUB-001"  
		self.doc.evaluator = "instructor@example.com"  
		self.doc.assignment = "ASSIGN-001"  
		self.doc.member = "student@example.com"  

		with patch("frappe.bold", return_value="<b>Python Basico</b>"):  
			with patch(f"{_MODULE}.get_lms_route", return_value="/lms/assignment-submission/ASSIGN-001/SUB-001"):  
				with patch(f"{_MODULE}.make_notification_logs") as mock_notify:  
					LMSAssignmentSubmission.trigger_update_notification(self.doc)  

					mock_notify.assert_called_once()  
					notification, recipients = mock_notify.call_args[0]  

					self.assertEqual(recipients, ["student@example.com"])  
					self.assertEqual(notification["type"], "Alert")  
					self.assertEqual(notification["from_user"], "instructor@example.com")  
					self.assertEqual(notification["email_content"], "Buen trabajo!")  
					self.assertEqual(notification["document_type"], "LMS Assignment Submission")  
					self.assertEqual(notification["document_name"], "SUB-001")  
					self.assertEqual(notification["link"], "/lms/assignment-submission/ASSIGN-001/SUB-001")