import unittest
from unittest.mock import patch

import frappe

import lms.www._lms as lms


def _route_meta(*rows):
    return [frappe._dict(row) for row in rows]


class TestLMS(unittest.TestCase):

    # UT-LMS-WWW-001: Método: get_boot() – Verifica que se construya correctamente el objeto boot con versión de Frappe, modo de lectura, token CSRF, sitio, idioma y dirección del texto.
    def test_get_boot(self):
        original_read_only = lms.frappe.flags.read_only
        original_site = lms.frappe.local.site

        lms.frappe.flags.read_only = True
        lms.frappe.local.site = "lms.localhost"

        try:
            with patch.object(lms, "get_lms_path", return_value="/lms"), patch.object(
                lms, "get_user_lang", return_value="en"
            ), patch.object(lms, "is_rtl", return_value=False), patch.object(
                lms.frappe.sessions, "get_csrf_token", return_value="csrf-token"
            ):
                boot = lms.get_boot()
        finally:
            lms.frappe.flags.read_only = original_read_only
            lms.frappe.local.site = original_site

        self.assertEqual(
            boot,
            frappe._dict(
                {
                    "frappe_version": frappe.__version__,
                    "read_only_mode": True,
                    "csrf_token": "csrf-token",
                    "site_name": "lms.localhost",
                    "lms_path": "/lms",
                    "lang": "en",
                    "text_direction": "ltr",
                }
            ),
        )

    # UT-LMS-WWW-002: Método: get_context() – Verifica que se genere correctamente el contexto principal de la aplicación incluyendo boot, metadata, favicon, título y registro de telemetría.
    def test_get_context(self):
        original_form_dict = lms.frappe.form_dict
        lms.frappe.form_dict = frappe._dict({"app_path": "courses"})

        try:
            with patch.object(lms, "get_boot", return_value=frappe._dict({"boot": "value"})), patch.object(
                lms, "get_meta", return_value=frappe._dict({"title": "Course List"})
            ), patch.object(lms, "capture") as capture_mock, patch.object(
                lms.frappe.db,
                "get_single_value",
                side_effect=["favicon.svg", "Learning App"],
            ), patch.object(lms.frappe.db, "commit") as commit_mock:
                context = lms.get_context()
        finally:
            lms.frappe.form_dict = original_form_dict

        commit_mock.assert_called_once()
        capture_mock.assert_called_once_with("active_site", "lms")
        self.assertEqual(context.boot, frappe._dict({"boot": "value"}))
        self.assertEqual(context.meta, frappe._dict({"title": "Course List"}))
        self.assertEqual(context.title, "Learning App")
        self.assertEqual(context.favicon, "favicon.svg")

    # UT-LMS-WWW-003: Método: get_meta() – Verifica que la metadata específica de una ruta se combine correctamente con la metadata global configurada en el LMS.
    def test_get_meta_merges_route_meta_and_site_defaults(self):
        with patch.object(lms, "get_meta_from_document", return_value=frappe._dict({
            "title": "Document Title",
            "image": "document.png",
            "description": "Document description",
            "keywords": "Document Keywords",
            "link": "/document",
        })), patch.object(lms.frappe, "get_all", return_value=_route_meta(
            {"key": "title", "value": "Route Title"},
            {"key": "image", "value": "route.png"},
            {"key": "description", "value": "Route description"},
            {"key": "keywords", "value": "Route Keywords"},
            {"key": "link", "value": "/route"},
        )), patch.object(
            lms.frappe.db,
            "get_single_value",
            side_effect=["Site description", "Site image", "Site keywords"],
        ):
            meta = lms.get_meta("courses/test-course", "Fallback Title", "fallback.png")

        self.assertEqual(meta["title"], "Route Title")
        self.assertEqual(meta["image"], "route.png")
        self.assertEqual(meta["description"], "Document description Route description")
        self.assertEqual(meta["keywords"], "Document Keywords Route Keywords, Site keywords")
        self.assertEqual(meta["link"], "/route")

    # UT-LMS-WWW-004: Método: get_meta() – Verifica que se utilicen los valores por defecto cuando una ruta no posee metadata propia.
    def test_get_meta_uses_fallback_values_without_route_meta(self):
        with patch.object(lms.frappe, "get_all", return_value=[]), patch.object(
            lms.frappe.db,
            "get_single_value",
            side_effect=["Site description", None, "Site keywords"],
        ):
            meta = lms.get_meta(None, "Fallback Title", "fallback.png")

        self.assertEqual(meta["title"], "Fallback Title")
        self.assertEqual(meta["description"], "Site description")
        self.assertEqual(meta["image"], "fallback.png")
        self.assertEqual(meta["keywords"], "None, Site keywords")

    def test_get_meta_from_document_static_routes(self):
        with patch.object(lms, "_", side_effect=lambda value: value), patch.object(
            lms, "get_lms_route", side_effect=lambda path: f"/lms/{path}"
        ), patch.object(lms.frappe.db, "get_single_value", return_value="banner.png"):
            
            # UT-LMS-WWW-005: Método: get_meta_from_document() – Verifica la generación de metadata para la página de listado de cursos.
            self.assertEqual(
                lms.get_meta_from_document("courses"),
                {
                    "title": "Course List",
                    "keywords": "All Courses, Courses, Learn",
                    "link": "/lms/courses",
                },
            )
            
            # UT-LMS-WWW-006: Método: get_meta_from_document() – Verifica la generación de metadata para la creación o edición de cursos.
            self.assertEqual(
                lms.get_meta_from_document("courses/new/edit"),
                {
                    "title": "New Course",
                    "image": "banner.png",
                    "keywords": "New Course, Create Course",
                    "link": "/lms/courses/new/edit",
                },
            )
            
            # UT-LMS-WWW-007: Método: get_meta_from_document() – Verifica la generación de metadata para la página de listado de batches.
            self.assertEqual(
                lms.get_meta_from_document("batches"),
                {
                    "title": "Batches",
                    "keywords": "All Batches, Batches, Learn",
                    "link": "/lms/batches",
                },
            )
            
            # UT-LMS-WWW-008: Método: get_meta_from_document() – Verifica la generación de metadata para la creación o edición de batches.
            self.assertEqual(
                lms.get_meta_from_document("batches/new/edit"),
                {
                    "title": "New Batch",
                    "keywords": "New Batch, Create Batch",
                    "link": "/lms/batches/new/edit",
                },
            )
            
            # UT-LMS-WWW-009: Método: get_meta_from_document() – Verifica la generación de metadata para el listado de oportunidades laborales.
            self.assertEqual(
                lms.get_meta_from_document("job-openings"),
                {
                    "title": "Job Openings",
                    "keywords": "Job Openings, Jobs, Vacancies",
                    "link": "/lms/job-openings",
                },
            )
            
            # UT-LMS-WWW-010: Método: get_meta_from_document() – Verifica la generación de metadata para la página de estadísticas del LMS.
            self.assertEqual(
                lms.get_meta_from_document("statistics"),
                {
                    "title": "Statistics",
                    "keywords": "Enrollment Count, Completion, Signups",
                    "link": "/lms/statistics",
                },
            )
            
            # UT-LMS-WWW-011: Método: get_meta_from_document() – Verifica la generación de metadata para el listado de quizzes.
            self.assertEqual(
                lms.get_meta_from_document("quizzes"),
                {
                    "title": "Quizzes",
                    "keywords": "Quizzes, interactive quizzes, online quizzes",
                    "link": "/lms/quizzes",
                },
            )
            
            # UT-LMS-WWW-012: Método: get_meta_from_document() – Verifica la generación de metadata para el listado de assignments.
            self.assertEqual(
                lms.get_meta_from_document("assignments"),
                {
                    "title": "Assignments",
                    "keywords": "Assignments, interactive assignments, online assignments",
                    "link": "/lms/assignments",
                },
            )
            
            # UT-LMS-WWW-013: Método: get_meta_from_document() – Verifica la generación de metadata para la página de programas.
            self.assertEqual(
                lms.get_meta_from_document("programs"),
                {
                    "title": "Programs",
                    "keywords": "All Programs, Programs, Learn",
                    "link": "/lms/programs",
                },
            )
            
            # UT-LMS-WWW-014: Método: get_meta_from_document() – Verifica la generación de metadata para la página de participantes certificados.
            self.assertEqual(
                lms.get_meta_from_document("certified-participants"),
                {
                    "title": "Certified Participants",
                    "keywords": "All Certified Participants, Certified Participants, Learn, Certification",
                    "link": "/lms/certified-participants",
                },
            )

    def test_get_meta_from_document_detail_routes(self):
        def get_value(doctype, name, fields, as_dict=True):
            if doctype == "LMS Course":
                return frappe._dict(
                    {
                        "title": "Course Title",
                        "image": "course.png",
                        "description": "<p>Course <strong>description</strong></p>",
                        "tags": "python, testing",
                    }
                )
            if doctype == "LMS Batch":
                return frappe._dict(
                    {
                        "title": "Batch Title",
                        "meta_image": "batch.png",
                        "batch_details": "<div>Batch <em>details</em></div>",
                        "category": "Engineering",
                        "medium": "Online",
                    }
                )
            if doctype == "Job Opportunity":
                return frappe._dict(
                    {
                        "job_title": "Job Title",
                        "company_logo": "job.png",
                        "description": "<p>Job <em>description</em></p>",
                    }
                )
            if doctype == "User":
                return frappe._dict(
                    {
                        "full_name": "Jane Doe",
                        "user_image": "user.png",
                        "bio": "<div>User <strong>bio</strong></div>",
                    }
                )
            if doctype == "LMS Badge":
                return frappe._dict(
                    {
                        "title": "Badge Title",
                        "image": "badge.png",
                        "description": "Badge description",
                    }
                )
            if doctype == "LMS Quiz":
                return frappe._dict({"title": "Quiz Title"})
            if doctype == "LMS Assignment":
                return frappe._dict({"title": "Assignment Title"})
            raise AssertionError(f"Unexpected lookup: {doctype} {name}")

        with patch.object(lms, "_", side_effect=lambda value: value), patch.object(
            lms, "get_lms_route", side_effect=lambda path: f"/lms/{path}"
        ), patch.object(lms.frappe.db, "get_value", side_effect=get_value), patch.object(
            lms.frappe.db, "get_single_value", return_value=None
        ):
            
            # UT-LMS-WWW-015: Método: get_meta_from_document() – Verifica la generación de metadata para un curso específico incluyendo la limpieza de etiquetas HTML en la descripción.
            self.assertEqual(
                lms.get_meta_from_document("courses/course-1"),
                {
                    "title": "Course Title",
                    "image": "course.png",
                    "description": "Course description",
                    "keywords": "python, testing",
                    "link": "/lms/courses/course-1",
                },
            )
            
            # UT-LMS-WWW-016: Método: get_meta_from_document() – Verifica la generación de metadata para el detalle de un batch eliminando etiquetas HTML del contenido.
            self.assertEqual(
                lms.get_meta_from_document("batches/details/batch-1"),
                {
                    "title": "Batch Title",
                    "image": "batch.png",
                    "description": "Batch details",
                    "keywords": "Engineering Online",
                    "link": "/lms/batches/details/batch-1",
                },
            )
            
            # UT-LMS-WWW-017: Método: get_meta_from_document() – Verifica la generación de metadata para un batch estándar eliminando etiquetas HTML del contenido.
            self.assertEqual(
                lms.get_meta_from_document("batches/batch-1"),
                {
                    "title": "Batch Title",
                    "image": "batch.png",
                    "description": "Batch details",
                    "keywords": "Engineering Online",
                    "link": "/lms/batches/batch-1",
                },
            )
            
            # UT-LMS-WWW-018: Método: get_meta_from_document() – Verifica la generación de metadata para una oportunidad laboral eliminando etiquetas HTML de la descripción.
            self.assertEqual(
                lms.get_meta_from_document("job-openings/job-1"),
                {
                    "title": "Job Title",
                    "image": "job.png",
                    "description": "Job description",
                    "keywords": "Job Openings, Jobs, Vacancies",
                    "link": "/lms/job-openings/job-1",
                },
            )
            
            # UT-LMS-WWW-019: Método: get_meta_from_document() – Verifica la generación de metadata para perfiles de usuario eliminando etiquetas HTML de la biografía.
            self.assertEqual(
                lms.get_meta_from_document("user/jane"),
                {
                    "title": "Jane Doe",
                    "image": "user.png",
                    "description": "User bio",
                    "keywords": "Jane Doe, User bio",
                    "link": "/lms/user/jane",
                },
            )
            
            # UT-LMS-WWW-020: Método: get_meta_from_document() – Verifica la generación de metadata para badges públicos asociados a un usuario.
            self.assertEqual(
                lms.get_meta_from_document("badges/badge-1/jane@example.com"),
                {
                    "title": "Badge Title",
                    "image": "badge.png",
                    "description": "Badge description",
                    "keywords": "Badge Title, Badge description",
                    "link": "/lms/badges/badge-1/jane@example.com",
                },
            )
            
            # UT-LMS-WWW-021: Método: get_meta_from_document() – Verifica la generación de metadata para quizzes individuales.
            self.assertEqual(
                lms.get_meta_from_document("quizzes/quiz-1"),
                {
                    "title": "Quiz Title",
                    "keywords": "Quiz Title",
                    "link": "/lms/quizzes/quiz-1",
                },
            )
            
            # UT-LMS-WWW-022: Método: get_meta_from_document() – Verifica la generación de metadata para assignments individuales.
            self.assertEqual(
                lms.get_meta_from_document("assignments/assignment-1"),
                {
                    "title": "Assignment Title",
                    "keywords": "Assignment Title",
                    "link": "/lms/assignments/assignment-1",
                },
            )

    # UT-LMS-WWW-023: Método: get_meta_from_document() – Verifica que una ruta no reconocida retorne un diccionario vacío sin realizar consultas innecesarias a la base de datos.
    def test_get_meta_from_document_unknown_route(self):
        with patch.object(lms.frappe.db, "get_value") as get_value:
            self.assertEqual(lms.get_meta_from_document("unknown/path"), {})

        get_value.assert_not_called()
