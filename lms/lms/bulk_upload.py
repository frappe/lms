# M4 · Bulk Upload of Learning Content
# Each file becomes one Course Lesson using the existing EditorJS 'upload' block structure.
# PPT/PPTX files are converted to PDF server-side via LibreOffice headless.

import json
import os
import subprocess

import frappe
from frappe import _

# ---------------------------------------------------------------------------
# File-type classification
# ---------------------------------------------------------------------------

VIDEO_EXTENSIONS = {"mp4", "mov", "avi", "mkv", "webm"}
IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp", "svg"}
PDF_EXTENSION = "pdf"
PPT_EXTENSIONS = {"ppt", "pptx"}

ALLOWED_EXTENSIONS = VIDEO_EXTENSIONS | IMAGE_EXTENSIONS | {PDF_EXTENSION} | PPT_EXTENSIONS


def _detect_type(file_name):
	"""Return (category, ext) where category is 'video'|'pdf'|'ppt'|'image'|'unknown'."""
	if "." not in file_name:
		return "unknown", ""
	ext = file_name.rsplit(".", 1)[-1].lower()
	if ext in VIDEO_EXTENSIONS:
		return "video", ext
	if ext == PDF_EXTENSION:
		return "pdf", "PDF"
	if ext in PPT_EXTENSIONS:
		return "ppt", ext
	if ext in IMAGE_EXTENSIONS:
		return "image", ext
	return "unknown", ext


# ---------------------------------------------------------------------------
# PPT → PDF conversion
# ---------------------------------------------------------------------------


def _convert_ppt_to_pdf(file_url):
	"""
	Convert an uploaded PPT/PPTX file to PDF using LibreOffice headless.
	Returns the file_url of the newly created PDF File doc.
	"""
	file_doc = frappe.db.get_value(
		"File", {"file_url": file_url}, ["file_name", "file_url"], as_dict=True
	)
	if not file_doc:
		frappe.throw(_("Uploaded file record not found for: {0}").format(file_url))

	file_path = frappe.get_site_path("public", file_doc.file_url.lstrip("/"))
	if not os.path.exists(file_path):
		frappe.throw(_("File not found on disk: {0}").format(file_path))

	output_dir = os.path.dirname(file_path)

	result = subprocess.run(
		[
			"libreoffice",
			"--headless",
			"--convert-to",
			"pdf",
			"--outdir",
			output_dir,
			file_path,
		],
		capture_output=True,
		text=True,
		timeout=120,
	)

	if result.returncode != 0:
		frappe.throw(
			_("LibreOffice conversion failed: {0}").format(result.stderr or result.stdout)
		)

	base_name = os.path.splitext(os.path.basename(file_path))[0]
	pdf_path = os.path.join(output_dir, base_name + ".pdf")

	if not os.path.exists(pdf_path):
		frappe.throw(_("LibreOffice finished but PDF output was not found"))

	# Derive the public file_url for the new PDF
	site_public = frappe.get_site_path("public")
	pdf_file_url = "/" + os.path.relpath(pdf_path, site_public)

	# Register the converted PDF as a Frappe File doc
	pdf_file = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": base_name + ".pdf",
			"file_url": pdf_file_url,
			"is_private": 0,
		}
	)
	pdf_file.insert(ignore_permissions=True)
	frappe.db.commit()

	return pdf_file_url


# ---------------------------------------------------------------------------
# EditorJS content builder
# ---------------------------------------------------------------------------


def _build_content(file_url, file_type_key):
	"""Return an EditorJS JSON string with a single 'upload' block."""
	return json.dumps(
		{
			"time": int(
				frappe.utils.now_datetime().timestamp() * 1000
			),
			"blocks": [
				{
					"id": frappe.generate_hash(length=10),
					"type": "upload",
					"data": {
						"file_url": file_url,
						"file_type": file_type_key,
						"quizzes": [],
					},
				}
			],
			"version": "2.29.0",
		}
	)


# ---------------------------------------------------------------------------
# Lesson + reference creation
# ---------------------------------------------------------------------------


def _next_lesson_idx(chapter):
	"""Return the idx for the next lesson in this chapter."""
	return frappe.db.count("Lesson Reference", {"parent": chapter}) + 1


def _create_lesson(title, chapter, course, content):
	"""Insert Course Lesson and its Lesson Reference, return lesson.name."""
	lesson = frappe.new_doc("Course Lesson")
	lesson.update(
		{
			"title": title,
			"chapter": chapter,
			"course": course,
			"content": content,
		}
	)
	lesson.insert(ignore_permissions=True)

	ref = frappe.new_doc("Lesson Reference")
	ref.update(
		{
			"lesson": lesson.name,
			"idx": _next_lesson_idx(chapter),
			"parent": chapter,
			"parenttype": "Course Chapter",
			"parentfield": "lessons",
		}
	)
	ref.insert(ignore_permissions=True)
	frappe.db.commit()
	return lesson.name


# ---------------------------------------------------------------------------
# Public whitelisted APIs
# ---------------------------------------------------------------------------


@frappe.whitelist()
def get_course_chapters(course):
	"""Return the ordered chapter list for a course (for the chapter selector)."""
	if not frappe.db.exists("LMS Course", course):
		frappe.throw(_("Course not found"))

	rows = frappe.get_all(
		"Chapter Reference",
		{"parent": course},
		["chapter", "idx"],
		order_by="idx",
	)
	result = []
	for row in rows:
		title = frappe.db.get_value("Course Chapter", row.chapter, "title")
		result.append({"name": row.chapter, "title": title, "idx": row.idx})
	return result


@frappe.whitelist()
def create_lesson_from_file(course, chapter, file_url, file_name):
	"""
	Create one Course Lesson from an already-uploaded Frappe File.
	Handles PPT/PPTX → PDF conversion automatically.

	Returns:
	  {"status": "Done",  "lesson_name": <name>}
	  {"status": "Error", "message": <str>}
	"""
	# Permission guard
	from lms.lms.api import can_modify_course

	if not can_modify_course(course):
		return {
			"status": "Error",
			"message": _("You do not have permission to modify this course."),
		}

	if not frappe.db.exists("Course Chapter", chapter):
		return {"status": "Error", "message": _("Chapter not found")}

	file_type, ext = _detect_type(file_name)
	if file_type == "unknown":
		return {
			"status": "Error",
			"message": _("Unsupported file type: .{0}").format(ext),
		}

	# PPT/PPTX: convert to PDF first
	if file_type == "ppt":
		try:
			file_url = _convert_ppt_to_pdf(file_url)
		except Exception as e:
			return {"status": "Error", "message": str(e)}
		file_type_key = "PDF"
	elif file_type == "video":
		file_type_key = ext  # 'mp4', 'mov', etc.
	elif file_type == "pdf":
		file_type_key = "PDF"
	else:  # image
		file_type_key = ext  # 'jpeg', 'png', etc.

	title = os.path.splitext(file_name)[0]
	content = _build_content(file_url, file_type_key)

	try:
		lesson_name = _create_lesson(title, chapter, course, content)
		return {"status": "Done", "lesson_name": lesson_name}
	except Exception:
		frappe.log_error(frappe.get_traceback(), "M4 bulk_upload: lesson creation failed")
		return {"status": "Error", "message": _("Failed to create lesson. Check error log.")}
