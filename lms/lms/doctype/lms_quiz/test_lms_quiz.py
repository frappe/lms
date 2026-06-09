# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import json
import re
import unittest

import frappe
from lms.lms.doctype.lms_quiz.lms_quiz import (
    set_total_marks,
    check_input_answers,
    verify_answer,
    _save_file,
    get_corrupted_image_msg,
    check_answer,
    check_choice_answers
)

def _create_mock_question(q_title, q_type="Choices"):
    """Helper function para crear LMS Questions reales requeridas por el validador de links de Frappe"""
    question = frappe.new_doc("LMS Question")
    question.question = q_title
    question.type = q_type
    
    if q_type == "Choices":
        question.option_1 = "Option 1"
        question.is_correct_1 = 1
        question.option_2 = "Option 2"
    elif q_type == "User Input":
        question.possibility_1 = "Correct Answer"
        
    question.save(ignore_permissions=True)
    return question.name


class TestLMSQuiz(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if not frappe.db.exists("LMS Quiz", "test-quiz"):
            frappe.get_doc({"doctype": "LMS Quiz", "title": "Test Quiz", "passing_percentage": 90}).save()

    def test_with_multiple_options(self):
        question = frappe.new_doc("LMS Question")
        question.question = "Question Multiple"
        question.type = "Choices"
        question.option_1 = "Option 1"
        question.is_correct_1 = 1
        question.option_2 = "Option 2"
        question.is_correct_2 = 1
        question.save()
        self.assertTrue(question.multiple)

    def test_with_no_correct_option(self):
        question = frappe.new_doc("LMS Question")
        question.question = "Question Multiple No Correct"
        question.type = "Choices"
        question.option_1 = "Option 1"
        question.option_2 = "Option 2"
        self.assertRaises(frappe.ValidationError, question.save)

    def test_with_no_possible_answers(self):
        question = frappe.new_doc("LMS Question")
        question.question = "Question User Input No Ans"
        question.type = "User Input"
        self.assertRaises(frappe.ValidationError, question.save)

    # ====================================================================
    # ---- NUEVOS CASOS DE PRUEBA AÑADIDOS PARA COBERTURA DEL 100% ----
    # ====================================================================

    def test_validate_duplicate_questions(self):
        quiz = frappe.new_doc("LMS Quiz")
        quiz.title = "Duplicate Questions Quiz"
        quiz.passing_percentage = 50
        
        q_name = _create_mock_question("Q_Dup_1")
        
        quiz.append("questions", {"question": q_name, "marks": 10})
        quiz.append("questions", {"question": q_name, "marks": 10})
        self.assertRaises(frappe.ValidationError, quiz.save)

    def test_validate_limit(self):
        quiz = frappe.new_doc("LMS Quiz")
        quiz.title = "Limit Quiz"
        quiz.passing_percentage = 50
        quiz.shuffle_questions = 1
        quiz.limit_questions_to = 5

        q1 = _create_mock_question("Q_limit_1")
        q2 = _create_mock_question("Q_limit_2")

        quiz.append("questions", {"question": q1, "marks": 10})
        quiz.append("questions", {"question": q2, "marks": 10})
        # Límite excede el número de preguntas reales
        self.assertRaises(frappe.ValidationError, quiz.save)

        quiz.limit_questions_to = 1
        quiz.questions[0].marks = 10
        quiz.questions[1].marks = 20
        # Límite establecido pero preguntas tienen distinto puntaje
        self.assertRaises(frappe.ValidationError, quiz.save)

        # Límite ignorado y reseteado a 0 si shuffle_questions no está activo
        quiz.shuffle_questions = 0
        quiz.limit_questions_to = 1
        quiz.questions[1].marks = 10
        quiz.save()
        self.assertEqual(quiz.limit_questions_to, 0)

    def test_calculate_total_marks(self):
        quiz = frappe.new_doc("LMS Quiz")
        quiz.title = "Marks Quiz"
        quiz.passing_percentage = 50
        quiz.save()
        
        # Test default
        self.assertEqual(quiz.total_marks, 0)
        self.assertEqual(quiz.passing_percentage, 100)

        q1 = _create_mock_question("Q_marks_1")
        q2 = _create_mock_question("Q_marks_2")

        quiz.append("questions", {"question": q1, "marks": 10})
        quiz.append("questions", {"question": q2, "marks": 10})
        quiz.save()
        self.assertEqual(quiz.total_marks, 20)

        quiz.shuffle_questions = 1
        quiz.limit_questions_to = 1
        quiz.save()
        # Con límite de 1 pregunta, el total debería ser 10
        self.assertEqual(quiz.total_marks, 10)

    def test_validate_open_ended_questions(self):
        quiz = frappe.new_doc("LMS Quiz")
        quiz.title = "Open Ended Quiz"
        quiz.passing_percentage = 50

        q_oe = _create_mock_question("Q_oe_1", "Open Ended")
        q_ch = _create_mock_question("Q_oe_2", "Choices")

        quiz.append("questions", {"question": q_oe, "marks": 10})
        quiz.append("questions", {"question": q_ch, "marks": 10})
        
        # Mezclar Open Ended con Choices lanza ValidationError
        self.assertRaises(frappe.ValidationError, quiz.save)

        quiz.questions.pop() # Quitar Choices
        quiz.show_answers = 1
        quiz.save()
        # Para puramente Open Ended, show_answers se fuerza a 0
        self.assertEqual(quiz.show_answers, 0)

    def test_autoname(self):
        quiz = frappe.new_doc("LMS Quiz")
        quiz.title = "Autoname Quiz Test"
        quiz.passing_percentage = 60
        quiz.save()
        self.assertTrue(quiz.name.startswith("autoname-quiz-test"))

    def test_set_total_marks(self):
        questions = [{"marks": 10}, {"marks": 25}]
        self.assertEqual(set_total_marks(questions), 35)

    def test_check_input_answers(self):
        question_name = _create_mock_question("Test Input Fuzzy Q", "User Input")

        # Coincidencia exacta
        self.assertEqual(check_input_answers(question_name, "Correct Answer"), 1)
        # Coincidencia parcial (Fuzzy Token Sort Ratio > 85%)
        self.assertEqual(check_input_answers(question_name, "Corret Answer"), 1)
        # Sin coincidencia (Fuzzy Ratio < 85%)
        self.assertEqual(check_input_answers(question_name, "Totally Wrong"), 0)

    def test_verify_answer(self):
        q_single = _create_mock_question("Single Choice Q Test")
        self.assertTrue(verify_answer(q_single, ["Option 1"]))
        self.assertFalse(verify_answer(q_single, ["Option 2"]))

        q_multi = frappe.new_doc("LMS Question")
        q_multi.question = "Multi Choice Q"
        q_multi.type = "Choices"
        q_multi.option_1 = "Option A"
        q_multi.is_correct_1 = 1
        q_multi.option_2 = "Option B"
        q_multi.is_correct_2 = 1
        q_multi.option_3 = "Option C"
        q_multi.save() 

        # Match exacto múltiple
        self.assertTrue(verify_answer(q_multi.name, ["Option A", "Option B"]))
        # Falta un valor esperado (Parcial)
        self.assertFalse(verify_answer(q_multi.name, ["Option A"]))
        # Valores de más
        self.assertFalse(verify_answer(q_multi.name, ["Option A", "Option B", "Option C"]))

    def test_check_choice_answers(self):
        q_check = frappe.new_doc("LMS Question")
        q_check.question = "Check Choice Return Array"
        q_check.type = "Choices"
        q_check.option_1 = "A"
        q_check.is_correct_1 = 1
        q_check.option_2 = "B"
        q_check.is_correct_2 = 0
        q_check.save()

        # Respuesta evaluada [1=CorrectoEnviado, 2=CorrectoOmitido, 0=Incorrecto]
        result = check_choice_answers(q_check.name, ["A"])
        self.assertEqual(result[0], 1)
        self.assertEqual(result[1], 0) 

        result2 = check_choice_answers(q_check.name, ["B"])
        self.assertEqual(result2[0], 2) # A es correcto pero se omitió
        self.assertEqual(result2[1], 0) # B es incorrecto (evaluación fallback)

    def test_save_file(self):
        # 1. Base64 Estándar
        img_html = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" />'
        match = re.search(r'<img[^>]*src\s*=\s*["\'](?=data:)(.*?)["\']', img_html)
        res = _save_file(match)
        self.assertIn("src=", res)

        # 2. Base64 conteniendo Nombre de Archivo explícito
        img_filename = '<img src="data:image/png;filename=test.png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" />'
        match2 = re.search(r'<img[^>]*src\s*=\s*["\'](?=data:)(.*?)["\']', img_filename)
        res2 = _save_file(match2)
        self.assertIn("src=", res2)

        # 3. Base64 Corrupto simulando un BinasciiError
        bad_html = '<img src="data:image/png;base64,corrupted!@#" />'
        match3 = re.search(r'<img[^>]*src\s*=\s*["\'](?=data:)(.*?)["\']', bad_html)
        res3 = _save_file(match3)
        self.assertIn("#broken-image", res3)
        self.assertIn(get_corrupted_image_msg(), res3)

    def test_check_answer_api(self):
        q_perm = _create_mock_question("Perm Check Q")
        
        quiz = frappe.new_doc("LMS Quiz")
        quiz.title = "Permission API Quiz"
        quiz.passing_percentage = 50
        quiz.show_answers = 0
        quiz.save()

        # Error: Pregunta huérfana (No en el Quiz) lanza PermissionError
        self.assertRaises(frappe.PermissionError, check_answer, quiz.name, q_perm, "Choices", json.dumps(["Option 1"]))

        # Relacionar pregunta usando el ORM Correctamente
        quiz.append("questions", {"question": q_perm, "marks": 10})
        quiz.save()

        # Admin sobrepasa el chequeo de live answers `show_answers=0`
        frappe.set_user("Administrator")
        res = check_answer(quiz.name, q_perm, "Choices", json.dumps(["Option 1"]))
        self.assertTrue(len(res) > 0)

        # Usar "Guest" garantizando que no se trata de un usuario con permisos de Manager almacenados en caché
        frappe.set_user("Guest")
        self.assertRaises(frappe.PermissionError, check_answer, quiz.name, q_perm, "Choices", json.dumps(["Option 1"]))

        frappe.set_user("Administrator") # Restaurar el usuario al predeterminado

    def test_get_last_submission_details(self):
        quiz = frappe.get_doc("LMS Quiz", "test-quiz")
        
        # Test para un usuario desconectado (Guest)
        frappe.set_user("Guest")
        self.assertIsNone(quiz.get_last_submission_details())

        # Test validando comportamiento normal
        frappe.set_user("Administrator")
        submission = frappe.new_doc("LMS Quiz Submission")
        submission.quiz = quiz.name
        submission.member = "Administrator"
        submission.percentage = 100
        submission.passing_percentage = 90
        submission.save(ignore_permissions=True)

        last_sub = quiz.get_last_submission_details()
        self.assertIsNotNone(last_sub)
        self.assertEqual(last_sub.name, submission.name)

    @classmethod
    def tearDownClass(cls) -> None:
        # Revertir los cambios transaccionales al terminar la clase
        frappe.db.rollback()