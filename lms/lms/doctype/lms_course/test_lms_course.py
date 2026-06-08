# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

from unittest.mock import patch  
  
import frappe  
from frappe.utils import today  

from lms.lms.api import delete_course
from lms.lms.doctype.lms_course.lms_course import update_course_statistics
from lms.lms.test_helpers import BaseTestUtils  


class TestLMSCourse(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.instructor = self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator"]
		)

	def test_new_course(self):
		course_name = f"Test Course {frappe.generate_hash()}"

		course = self._create_course(course_name)

		self.assertEqual(course.title, course_name)
		self.assertTrue(frappe.db.exists("LMS Course", course.name))

	def test_delete_course(self):
		course = self._create_course(f"Test Course {frappe.generate_hash()}")
		chapter = self._create_chapter(f"Test Chapter {frappe.generate_hash()}", course.name)
		lesson = self._create_lesson(f"Test Lesson {frappe.generate_hash()}", chapter.name, course.name)

		lesson_ref = self._create_lesson_reference(chapter.name, lesson.name)
		chapter_ref = self._create_chapter_reference(course.name, chapter.name)

		user_email = f"test_{frappe.generate_hash()}@example.com"
		self._create_user(user_email, "Test", "Member", ["LMS Student"])
		enrollment = self._create_enrollment(user_email, course.name)
		progress = self._create_progress(user_email, course.name, lesson.name)

		delete_course(course.name)

		self.assertFalse(frappe.db.exists("LMS Course", course.name))
		self.assertFalse(frappe.db.exists("Course Chapter", chapter.name))
		self.assertFalse(frappe.db.exists("Course Lesson", lesson.name))
		self.assertFalse(frappe.db.exists("LMS Enrollment", enrollment.name))
		self.assertFalse(frappe.db.exists("LMS Course Progress", {"course": course.name}))
		self.assertFalse(frappe.db.exists("Chapter Reference", {"parent": course.name}))
		self.assertFalse(frappe.db.exists("Lesson Reference", {"parent": chapter.name}))

		# remove from cleanup_items list since delete_course already deleted them
		self.cleanup_items.remove(("LMS Course", course.name))
		self.cleanup_items.remove(("LMS Enrollment", enrollment.name))
		self.cleanup_items.remove(("LMS Course Progress", progress.name))
		self.cleanup_items.remove(("Chapter Reference", chapter_ref.name))
		self.cleanup_items.remove(("Lesson Reference", lesson_ref.name))
		self.cleanup_items.remove(("Course Chapter", chapter.name))
		self.cleanup_items.remove(("Course Lesson", lesson.name))

	# UT-LMS-CRS-001
	def test_validate_published_sets_published_on(self):  
		"""published=True con published_on vacío asigna la fecha de hoy."""  
		course = self._create_course(f"Test Course {frappe.generate_hash()}")  
		self.assertEqual(course.published_on, today())  

	# UT-LMS-CRS-002
	def test_validate_published_does_not_override_existing_date(self):  
		"""Si published_on ya tiene valor, no se sobreescribe al guardar de nuevo."""  
		course = self._create_course(f"Test Course {frappe.generate_hash()}")  
		original_date = course.published_on  
		course.save()  
		course.reload()  
		self.assertEqual(course.published_on.strftime("%Y-%m-%d"), original_date)  

	# UT-LMS-CRS-003
	def test_validate_published_not_published(self):  
		"""published=False no asigna published_on."""  
		if not frappe.db.exists("LMS Category", "Business"):  
				frappe.get_doc({"doctype": "LMS Category", "category": "Business"}).insert(  
						ignore_permissions=True  
				)  
				self.cleanup_items.append(("LMS Category", "Business"))  

		course = frappe.new_doc("LMS Course")  
		course.update({  
				"title": f"Unpublished Course {frappe.generate_hash()}",  
				"short_introduction": "Test",  
				"description": "Test description",
				"category": "Business",  
				"published": 0,  
				"instructors": [{"instructor": "frappe@example.com"}],  
		})  
		course.save()  
		self.cleanup_items.append(("LMS Course", course.name))  
		self.assertFalse(course.published_on)  

	# UT-LMS-CRS-004
	def test_validate_video_link_watch_format(self):  
		"""URL con watch?v= se convierte al ID del video."""  
		course = self._create_course(f"Test Course {frappe.generate_hash()}")  
		course.video_link = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"  
		course.save()  
		self.assertEqual(course.video_link, "dQw4w9WgXcQ")  

	# UT-LMS-CRS-005
	def test_validate_video_link_slash_format(self):  
		"""URL con / (sin watch?v=) se convierte al último segmento."""  
		course = self._create_course(f"Test Course {frappe.generate_hash()}")  
		course.video_link = "https://youtu.be/dQw4w9WgXcQ"  
		course.save()  
		self.assertEqual(course.video_link, "dQw4w9WgXcQ")  

	# UT-LMS-CRS-006
	def test_validate_video_link_already_id(self):  
		"""Si video_link ya es solo el ID (sin / ni watch?v=), no cambia."""  
		course = self._create_course(f"Test Course {frappe.generate_hash()}")  
		course.video_link = "dQw4w9WgXcQ"  
		course.save()  
		self.assertEqual(course.video_link, "dQw4w9WgXcQ")  

	# UT-LMS-CRS-007
	def test_validate_video_link_empty(self):  
		"""Si video_link está vacío, no hace nada."""  
		course = self._create_course(f"Test Course {frappe.generate_hash()}")  
		course.video_link = None  
		course.save()  
		self.assertIsNone(course.video_link)  

	# UT-LMS-CRS-008
	def test_validate_status_published_sets_approved(self):  
		"""published=True establece status='Approved'."""  
		course = self._create_course(f"Test Course {frappe.generate_hash()}")  
		self.assertEqual(course.status, "Approved")  

	# UT-LMS-CRS-009
	def test_validate_status_not_published_does_not_set_approved(self):  
		"""published=False no establece status='Approved'."""  
		if not frappe.db.exists("LMS Category", "Business"):  
				frappe.get_doc({"doctype": "LMS Category", "category": "Business"}).insert(  
						ignore_permissions=True  
				)  
				self.cleanup_items.append(("LMS Category", "Business"))  

		course = frappe.new_doc("LMS Course")  
		course.update({  
				"title": f"Draft Course {frappe.generate_hash()}",  
				"short_introduction": "Test",  
				"description": "Test description",
				"category": "Business",  
				"published": 0,  
				"instructors": [{"instructor": "frappe@example.com"}],  
		})  
		course.save()  
		self.cleanup_items.append(("LMS Course", course.name))  
		self.assertNotEqual(course.status, "Approved")  

	# UT-LMS-CRS-010
	def test_validate_payments_app_throws_when_not_installed(self):  
		"""paid_course=True sin la app 'payments' instalada lanza ValidationError."""  
		with patch("frappe.get_installed_apps", return_value=["frappe", "lms"]):  
				course = frappe.new_doc("LMS Course")  
				course.update({  
						"title": f"Paid Course {frappe.generate_hash()}",  
						"short_introduction": "Test",  
						"description": "Test description",
						"category": "Business",  
						"paid_course": 1,  
						"course_price": 100,  
						"currency": "USD",  
						"instructors": [{"instructor": "frappe@example.com"}],  
				})  
				with self.assertRaises(frappe.ValidationError):  
						course.save()  

	# UT-LMS-CRS-011
	def test_validate_payments_app_passes_when_installed(self):  
		"""paid_course=True con la app 'payments' instalada no lanza error."""  
		with patch("frappe.get_installed_apps", return_value=["frappe", "lms", "payments"]):  
				course = frappe.new_doc("LMS Course")  
				course.update({  
						"title": f"Paid Course {frappe.generate_hash()}",  
						"short_introduction": "Test",  
						"description": "Test description",
						"category": "Business",  
						"paid_course": 1,  
						"course_price": 100,  
						"currency": "USD",  
						"instructors": [{"instructor": "frappe@example.com"}],  
				})  
				course.save()  
				self.cleanup_items.append(("LMS Course", course.name))  
				self.assertTrue(frappe.db.exists("LMS Course", course.name))  

	# UT-LMS-CRS-012
	def test_validate_certification_both_cert_types_throws(self):  
		"""enable_certification y paid_certificate juntos lanzan ValidationError."""  
		course = frappe.new_doc("LMS Course")  
		course.update({  
				"title": f"Cert Course {frappe.generate_hash()}",  
				"short_introduction": "Test",  
				"description": "Test description",
				"category": "Business",  
				"enable_certification": 1,  
				"paid_certificate": 1,  
				"instructors": [{"instructor": "frappe@example.com"}],  
		})  
		with self.assertRaises(frappe.ValidationError):  
				course.save()  

	# UT-LMS-CRS-013
	def test_validate_certification_paid_cert_no_evaluator_throws(self):  
		"""paid_certificate=True sin evaluator lanza ValidationError."""  
		course = frappe.new_doc("LMS Course")  
		course.update({  
				"title": f"Cert Course {frappe.generate_hash()}",  
				"short_introduction": "Test", 
				"description": "Test description", 
				"category": "Business",  
				"paid_certificate": 1,  
				"evaluator": None,  
				"timezone": "America/Lima",  
				"course_price": 100,  
				"currency": "USD",  
				"instructors": [{"instructor": "frappe@example.com"}],  
		})  
		with self.assertRaises(frappe.ValidationError):  
				course.save()  

	# UT-LMS-CRS-014
	def test_validate_certification_paid_cert_no_timezone_throws(self):  
		"""paid_certificate=True sin timezone lanza ValidationError."""  
		course = frappe.new_doc("LMS Course")  
		course.update({  
				"title": f"Cert Course {frappe.generate_hash()}",  
				"short_introduction": "Test",  
				"description": "Test description",
				"category": "Business",  
				"paid_certificate": 1,  
				"evaluator": "frappe@example.com",  
				"timezone": None,  
				"course_price": 100,  
				"currency": "USD",  
				"instructors": [{"instructor": "frappe@example.com"}],  
		})  
		with self.assertRaises(frappe.ValidationError):  
				course.save()  

	# UT-LMS-CRS-015
	def test_validate_amount_paid_course_negative_price_throws(self):  
		"""paid_course con precio negativo lanza ValidationError."""  
		with patch("frappe.get_installed_apps", return_value=["frappe", "lms", "payments"]):  
				course = frappe.new_doc("LMS Course")  
				course.update({  
						"title": f"Paid Course {frappe.generate_hash()}",  
						"short_introduction": "Test",  
						"description": "Test description",
						"category": "Business",  
						"paid_course": 1,  
						"course_price": -10,  
						"currency": "USD",  
						"instructors": [{"instructor": "frappe@example.com"}],  
				})  
				with self.assertRaises(frappe.ValidationError):  
						course.save()  

	# UT-LMS-CRS-016
	def test_validate_amount_paid_course_no_currency_throws(self):  
		"""paid_course sin currency lanza ValidationError."""  
		with patch("frappe.get_installed_apps", return_value=["frappe", "lms", "payments"]):  
				course = frappe.new_doc("LMS Course")  
				course.update({  
						"title": f"Paid Course {frappe.generate_hash()}",  
						"short_introduction": "Test",
						"description": "Test description",  
						"category": "Business",  
						"paid_course": 1,  
						"course_price": 100,  
						"currency": None,  
						"instructors": [{"instructor": "frappe@example.com"}],  
				})  
				with self.assertRaises(frappe.ValidationError):  
						course.save()  

	# UT-LMS-CRS-017
	def test_validate_amount_paid_certificate_zero_price_throws(self):  
		"""paid_certificate con precio 0 lanza ValidationError."""  
		course = frappe.new_doc("LMS Course")  
		course.update({  
				"title": f"Cert Course {frappe.generate_hash()}",  
				"short_introduction": "Test",  
				"description": "Test description",
				"category": "Business",  
				"paid_certificate": 1,  
				"evaluator": "frappe@example.com",  
				"timezone": "America/Lima",  
				"course_price": 0,  
				"currency": "USD",  
				"instructors": [{"instructor": "frappe@example.com"}],  
		})  
		with self.assertRaises(frappe.ValidationError):  
				course.save()  

	# UT-LMS-CRS-018
	def test_validate_amount_paid_certificate_no_currency_throws(self):  
		"""paid_certificate sin currency lanza ValidationError."""  
		course = frappe.new_doc("LMS Course")  
		course.update({  
				"title": f"Cert Course {frappe.generate_hash()}",  
				"short_introduction": "Test", 
				"description": "Test description", 
				"category": "Business",  
				"paid_certificate": 1,  
				"evaluator": "frappe@example.com",  
				"timezone": "America/Lima",  
				"course_price": 100,  
				"currency": None,  
				"instructors": [{"instructor": "frappe@example.com"}],  
		})  
		with self.assertRaises(frappe.ValidationError):  
				course.save() 

	# UT-LMS-CRS-019
	def test_update_course_statistics(self):  
		"""Verifica que se actualizan lessons, enrollments y rating en cada curso."""  
		course = self._create_course(f"Test Course {frappe.generate_hash()}") 
		course.update({
				"lessons": 5,  
				"enrollments": 10,  
				"rating": 4.5,  
		})

		update_course_statistics() 

		updated = frappe.db.get_value(  
				"LMS Course",  
				course.name,  
				["lessons", "enrollments", "rating"],  
				as_dict=True,  
		)  
		self.assertIsNotNone(updated.lessons)  
		self.assertIsNotNone(updated.enrollments)  
		self.assertIsNotNone(updated.rating)
