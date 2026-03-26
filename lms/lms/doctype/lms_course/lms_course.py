# Copyright (c) 2021, Frappe and contributors
# For license information, please see license.txt

import random
import json
import zipfile
import os
import tempfile
import shutil

import frappe
from frappe import _
from frappe.desk.doctype.notification_log.notification_log import make_notification_logs
from frappe.model.document import Document
from frappe.utils import cint, flt, today

from ...utils import (
    generate_slug,
    get_average_rating,
    get_instructors,
    get_lesson_count,
    get_lms_route,
    update_payment_record,
    validate_image,
)

class LMSCourse(Document):
    def validate(self):
        self.validate_published()
        self.validate_instructors()
        self.validate_video_link()
        self.validate_status()
        self.validate_payments_app()
        self.validate_certification()
        self.validate_amount_and_currency()
        self.image = validate_image(self.image)
        self.validate_card_gradient()

    def validate_published(self):
        if self.published and not self.published_on:
            self.published_on = today()

    def validate_instructors(self):
        if self.is_new() and not self.instructors:
            frappe.get_doc(
                {
                    "doctype": "Course Instructor",
                    "instructor": self.owner,
                    "parent": self.name,
                    "parentfield": "instructors",
                    "parenttype": "LMS Course",
                }
            ).save(ignore_permissions=True)

    def validate_video_link(self):
        if self.video_link and "watch?v=" in self.video_link:
            self.video_link = self.video_link.split("watch?v=")[-1]
        elif self.video_link and "/" in self.video_link:
            self.video_link = self.video_link.split("/")[-1]

    def validate_status(self):
        if self.published:
            self.status = "Approved"

    def validate_payments_app(self):
        if self.paid_course:
            installed_apps = frappe.get_installed_apps()
            if "payments" not in installed_apps:
                documentation_link = "https://docs.frappe.io/learning/setting-up-payment-gateway"
                frappe.throw(
                    _(
                        "Please install the Payments App to create a paid course. Refer to the documentation for more details. {0}"
                    ).format(documentation_link)
                )

    def validate_certification(self):
        if self.enable_certification and self.paid_certificate:
            frappe.throw(_("A course cannot have both paid certificate and certificate of completion."))

        if self.paid_certificate and not self.evaluator:
            frappe.throw(_("Evaluator is required for paid certificates."))

        if self.paid_certificate and not self.timezone:
            frappe.throw(_("Timezone is required for paid certificates."))

    def validate_amount_and_currency(self):
        if self.paid_course and (cint(self.course_price) < 0 or not self.currency):
            frappe.throw(_("Amount and currency are required for paid courses."))

        if self.paid_certificate and (cint(self.course_price) <= 0 or not self.currency):
            frappe.throw(_("Amount and currency are required for paid certificates."))

    def validate_card_gradient(self):
        if not self.image and not self.card_gradient:
            colors = [
                "Red",
                "Blue",
                "Green",
                "Yellow",
                "Orange",
                "Pink",
                "Amber",
                "Violet",
                "Cyan",
                "Teal",
                "Gray",
                "Purple",
            ]
            self.card_gradient = random.choice(colors)

    def on_update(self):
        if not self.upcoming and self.has_value_changed("upcoming"):
            self.send_email_to_interested_users()

    def on_payment_authorized(self, payment_status):
        if payment_status in ["Authorized", "Completed"]:
            update_payment_record("LMS Course", self.name)

    def send_email_to_interested_users(self):
        interested_users = frappe.get_all("LMS Course Interest", {"course": self.name}, ["name", "user"])
        subject = self.title + " is available!"
        args = {
            "title": self.title,
            "course_link": get_lms_route(f"courses/{self.name}"),
            "app_name": frappe.db.get_single_value("System Settings", "app_name"),
            "site_url": frappe.utils.get_url(),
        }

        for user in interested_users:
            args["first_name"] = frappe.db.get_value("User", user.user, "first_name")
            email_args = frappe._dict(
                recipients=user.user,
                subject=subject,
                header=[subject, "green"],
                template="lms_course_interest",
                args=args,
                now=True,
            )
            frappe.enqueue(method=frappe.sendmail, queue="short", timeout=300, is_async=True, **email_args)
            frappe.db.set_value("LMS Course Interest", user.name, "email_sent", True)

    def autoname(self):
        if not self.name:
            self.name = generate_slug(self.title, "LMS Course")

    def __repr__(self):
        return f"<Course#{self.name}>"


def send_notification_for_published_courses():
    send_notification = frappe.db.get_single_value("LMS Settings", "send_notification_for_published_courses")
    if not send_notification:
        return

    courses_published_today = frappe.get_all(
        "LMS Course",
        {
            "published_on": today(),
            "notification_sent": 0,
        },
        ["name", "title", "short_introduction"],
    )

    if not courses_published_today:
        return

    if send_notification == "Email":
        send_email_notification_for_published_courses(courses_published_today)
    else:
        send_system_notification_for_published_courses(courses_published_today)


def send_email_notification_for_published_courses(courses):
    brand_name = frappe.db.get_single_value("Website Settings", "app_name")
    brand_logo = frappe.db.get_single_value("Website Settings", "banner_image")
    subject = _("A new course has been published on {0}").format(brand_name)
    template = "published_course_notification"
    students = frappe.get_all("User", {"enabled": 1}, pluck="name")

    for course in courses:
        instructors = get_instructors("LMS Course", course.name)

        args = {
            "brand_logo": brand_logo,
            "brand_name": brand_name,
            "title": course.title,
            "short_introduction": course.short_introduction,
            "instructors": instructors,
            "course_url": frappe.utils.get_url(get_lms_route(f"courses/{course.name}")),
        }

        frappe.sendmail(
            recipients=instructors,
            bcc=students,
            subject=subject,
            template=template,
            args=args,
        )
        frappe.db.set_value("LMS Course", course.name, "notification_sent", 1)


def send_system_notification_for_published_courses(courses):
    for course in courses:
        students = frappe.get_all("User", {"enabled": 1}, pluck="name")
        instructors = frappe.get_all("Course Instructor", {"parent": course.name}, pluck="instructor")
        instructor_name = frappe.db.get_value("User", instructors[0], "full_name")
        notification = frappe._dict(
            {
                "subject": _("{0} has published a new course {1}").format(
                    frappe.bold(instructor_name), frappe.bold(course.title)
                ),
                "email_content": _(
                    "A new course '{0}' has been published that might interest you. Check it out!"
                ).format(course.title),
                "document_type": "LMS Course",
                "document_name": course.name,
                "from_user": instructors[0] if instructors else None,
                "type": "Alert",
                "link": get_lms_route(f"courses/{course.name}"),
            }
        )
        make_notification_logs(notification, students)
        frappe.db.set_value("LMS Course", course.name, "notification_sent", 1)


def update_course_statistics():
    courses = frappe.get_all("LMS Course", fields=["name"])

    for course in courses:
        lessons = get_lesson_count(course.name)
        enrollments = frappe.db.count("LMS Enrollment", {"course": course.name, "member_type": "Student"})
        avg_rating = get_average_rating(course.name) or 0
        avg_rating = flt(avg_rating, frappe.get_system_settings("float_precision") or 3)

        frappe.db.set_value(
            "LMS Course",
            course.name,
            {"lessons": lessons, "enrollments": enrollments, "rating": avg_rating},
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_unique_course_title(base_title):
    """Devuelve un título de curso que no exista aún en la base de datos."""
    if not frappe.db.exists("LMS Course", {"title": base_title}):
        return base_title
    counter = 1
    while frappe.db.exists("LMS Course", {"title": f"{base_title} ({counter})"}):
        counter += 1
    return f"{base_title} ({counter})"


def safe_extract(zip_ref, target_dir):
    """
    Extrae un ZIP validando que ninguna ruta apunte fuera de target_dir
    (previene ataques de path traversal).
    """
    real_target = os.path.realpath(target_dir)
    for member in zip_ref.namelist():
        member_path = os.path.realpath(os.path.join(target_dir, member))
        if not member_path.startswith(real_target + os.sep) and member_path != real_target:
            frappe.throw(
                _("El archivo ZIP contiene rutas inválidas y no puede ser procesado.")
            )
    zip_ref.extractall(target_dir)


# ---------------------------------------------------------------------------
# Exportación
# ---------------------------------------------------------------------------

@frappe.whitelist()
def export_course(course_name: str):
    """Exporta un curso a un archivo ZIP descargable con todos los campos."""
    if not frappe.has_permission("LMS Course", "read", course_name):
        frappe.throw(_("No tienes permisos para exportar este curso"), frappe.PermissionError)

    course = frappe.get_doc("LMS Course", course_name)

    # 1. Construir diccionario completo basado en los campos del JSON
    course_data = {
        "title": course.title,
        "short_introduction": course.short_introduction,
        "description": course.description,
        "category": course.category,
        "image": course.image,
        "video_link": course.video_link,
        "tags": course.tags,
        "published": course.published,
        "disable_self_learning": course.disable_self_learning,
        "paid_course": course.paid_course,
        "paid_certificate": course.paid_certificate,
        "enable_certification": course.enable_certification,
        "card_gradient": course.card_gradient,
        "instructors": [],
        "chapters": [],
    }

    # Exportar Instructores (Solo guardamos el email/link)
    for inst in course.instructors:
        course_data["instructors"].append({
            "instructor": inst.instructor
        })

    # Exportar Estructura
    for chapter_ref in course.chapters:
        chapter_doc_name = chapter_ref.chapter if hasattr(chapter_ref, "chapter") else chapter_ref.name
        chapter_doc = frappe.get_doc("Course Chapter", chapter_doc_name)

        chapter_data = {
            "title": chapter_doc.title,
            "is_scorm_package": chapter_doc.is_scorm_package,
            "lessons": [],
        }

        for lesson_ref in chapter_doc.lessons:
            lesson_doc_name = lesson_ref.lesson if hasattr(lesson_ref, "lesson") else lesson_ref.name
            lesson_doc = frappe.get_doc("Course Lesson", lesson_doc_name)

            chapter_data["lessons"].append(
                {
                    "title": lesson_doc.title,
                    "body": lesson_doc.body,
                    "content": lesson_doc.content,
                    "youtube": lesson_doc.youtube,
                }
            )

        course_data["chapters"].append(chapter_data)

    # 2. Crear ZIP
    from io import BytesIO

    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zipf:
        zipf.writestr("course.json", json.dumps(course_data, indent=4, ensure_ascii=False))

        if course.image:
            file_path = course.image
            site_path = frappe.get_site_path()

            real_file_path = ""
            if file_path.startswith("/files/"):
                real_file_path = os.path.join(site_path, "public", file_path.lstrip("/"))
            elif file_path.startswith("/private/files/"):
                real_file_path = os.path.join(site_path, file_path.lstrip("/"))

            if real_file_path and os.path.exists(real_file_path):
                zipf.write(real_file_path, os.path.join("assets", os.path.basename(real_file_path)))
            else:
                frappe.log_error(f"Archivo no encontrado: {real_file_path}", "Export Course Error")

    file_name = f"curso_{course.name}.zip"
    frappe.response["filename"] = file_name
    frappe.response["filecontent"] = zip_buffer.getvalue()
    frappe.response["type"] = "download"

    return file_name


# ---------------------------------------------------------------------------
# Importación
# ---------------------------------------------------------------------------

@frappe.whitelist()
def import_course(file_url: str):
    """Importa un curso desde un archivo ZIP."""

    # 1. Localizar el archivo en el File Manager
    file_docs = frappe.get_all("File", filters={"file_url": file_url}, fields=["name"])
    if not file_docs:
        frappe.throw(_("No se encontró el archivo en el sistema. Asegúrate de haberlo subido correctamente."))

    file_doc = frappe.get_doc("File", file_docs[0].name)
    file_path = file_doc.get_full_path()

    if not os.path.exists(file_path):
        frappe.throw(_("La ruta física del archivo no existe en el servidor."))

    temp_dir = tempfile.mkdtemp()

    try:
        # 2. Extraer el ZIP de forma segura
        with zipfile.ZipFile(file_path, "r") as zip_ref:
            safe_extract(zip_ref, temp_dir)

        # 3. Leer JSON
        json_path = os.path.join(temp_dir, "course.json")
        if not os.path.exists(json_path):
            frappe.throw(_("El archivo ZIP no contiene course.json. Verifica que sea un export válido."))

        with open(json_path, "r", encoding="utf-8") as f:
            course_data = json.load(f)

        # 4. Crear el documento LMS Course
        course = frappe.new_doc("LMS Course")
        course.title = get_unique_course_title(course_data.get("title"))
        course.short_introduction = course_data.get("short_introduction")
        course.description = course_data.get("description")
        course.video_link = course_data.get("video_link")
        course.tags = course_data.get("tags")
        course.disable_self_learning = course_data.get("disable_self_learning")
        course.paid_course = course_data.get("paid_course")
        course.paid_certificate = course_data.get("paid_certificate")
        course.enable_certification = course_data.get("enable_certification")
        course.card_gradient = course_data.get("card_gradient")
        
        # Categoria (validar existencia)
        raw_category = course_data.get("category")
        if raw_category and frappe.db.exists("LMS Category", raw_category):
            course.category = raw_category

        # 5. Importar Instructores
        # Si el instructor del ZIP no existe, usamos el usuario actual
        instructors_imported = False
        for inst in course_data.get("instructors", []):
            email = inst.get("instructor")
            if email and frappe.db.exists("User", email):
                course.append("instructors", {"instructor": email})
                instructors_imported = True
        
        if not instructors_imported:
            course.append("instructors", {"instructor": frappe.session.user})

        # Insertar Curso para obtener ID
        course.insert(ignore_permissions=True)
        course_name = course.name

        # 6. Adjuntar imagen
        if course_data.get("image"):
            image_filename = os.path.basename(course_data["image"])
            asset_path = os.path.join(temp_dir, "assets", image_filename)
            if os.path.exists(asset_path):
                with open(asset_path, "rb") as img_file:
                    filedata = img_file.read()
                saved_file = frappe.get_doc({
                    "doctype": "File",
                    "file_name": image_filename,
                    "attached_to_doctype": "LMS Course",
                    "attached_to_name": course_name,
                    "is_private": 0,
                    "content": filedata,
                    "decode": False,
                }).insert(ignore_permissions=True)
                frappe.db.set_value("LMS Course", course_name, "image", saved_file.file_url)

        # 7. Crear capítulos y lecciones
        chapter_names = []

        for chapter_data in course_data.get("chapters", []):
            chapter = frappe.new_doc("Course Chapter")
            chapter.course = course_name
            chapter.title = chapter_data.get("title") or _("Capítulo sin título")
            chapter.insert(ignore_permissions=True)
            chapter_name = chapter.name

            for lesson_data in chapter_data.get("lessons", []):
                lesson = frappe.new_doc("Course Lesson")
                lesson.course = course_name
                lesson.chapter = chapter_name
                lesson.title = lesson_data.get("title") or _("Lección sin título")
                lesson.body = lesson_data.get("body")
                lesson.content = lesson_data.get("content")
                lesson.youtube = lesson_data.get("youtube")
                lesson.insert(ignore_permissions=True)

                # Actualizar timestamp del capítulo antes de agregar lección
                chapter = frappe.get_doc("Course Chapter", chapter_name)
                chapter.append("lessons", {"lesson": lesson.name})
                chapter.save(ignore_permissions=True)

            chapter_names.append(chapter_name)

        # 8. Vincular capítulos al curso
        course = frappe.get_doc("LMS Course", course_name)
        for ch_name in chapter_names:
            course.append("chapters", {"chapter": ch_name})
        course.save(ignore_permissions=True)

        frappe.db.commit()
        return course_name

    except Exception:
        frappe.db.rollback()
        frappe.log_error(frappe.get_traceback(), "Import Course Error")
        frappe.throw(_("Error al importar el curso. Revisa los logs para más detalles."))

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)