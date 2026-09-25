"""F3: turn a teacher's existing material (slides, syllabus, exercises) into a course draft.

Flow::

    teacher uploads files -> Copilot Course Import (text extracted here, page by page)
      -> AI Gateway job reads the pages, drafts outline + lessons + assignments + rubrics
      -> propose_course_draft -> Copilot Proposal "Course Draft" -> teacher approves
      -> course, chapters, lessons, assignments and rubrics are created, unpublished

Nothing is created in the LMS before approval. Every lesson must point at the pages it
came from; a lesson without a valid source is flagged "missing material" and blocks a
plain approval until the teacher chooses to keep (marked for completion) or drop it.
"""

import io
import re
import zipfile
from xml.etree import ElementTree

import frappe
from frappe import _
from frappe.utils import cint, now_datetime

from lms.copilot import access, gateway
from lms.copilot.validation import existing, fail, load_json, optional_text, parse_list, required_text

MAX_FILES = 10
MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_PAGES_PER_FILE = 400
PAGE_CHARS = 6000
SECTION_CHARS = 3000
MAX_IMPORT_CHARS = 300000
UNITS = {"pdf": "page", "pptx": "slide", "docx": "section", "markdown": "section", "text": "section"}
EXTENSIONS = {
	"pdf": "pdf",
	"pptx": "pptx",
	"docx": "docx",
	"md": "markdown",
	"markdown": "markdown",
	"txt": "text",
}
OPEN_STATUSES = ("Queued", "Ready", "Failed")


# ------------------------------------------------------------------ extraction


def _clean(text):
	text = re.sub(r"[ \t ]+", " ", str(text or ""))
	text = re.sub(r" *\n *", "\n", text)
	return re.sub(r"\n{3,}", "\n\n", text).strip()


def _pages(texts):
	"""Numbered pages with text, capped so one scanned book cannot flood the prompt."""
	pages = []
	for number, text in enumerate(texts, 1):
		text = _clean(text)
		if text:
			pages.append({"page": number, "text": text[:PAGE_CHARS]})
		if number >= MAX_PAGES_PER_FILE:
			break
	return pages


def _chunk_sections(sections):
	"""Split long sections so each numbered section stays citable."""
	result = []
	for section in sections:
		section = section.strip()
		while len(section) > SECTION_CHARS:
			cut = section.rfind("\n", 0, SECTION_CHARS)
			cut = cut if cut > SECTION_CHARS // 2 else SECTION_CHARS
			result.append(section[:cut])
			section = section[cut:].strip()
		if section:
			result.append(section)
	return result


def extract_pdf(content):
	from pypdf import PdfReader

	reader = PdfReader(io.BytesIO(content))
	if reader.is_encrypted:
		try:
			reader.decrypt("")
		except Exception:
			fail(_("The PDF is password protected."))
	return _pages(page.extract_text() or "" for page in reader.pages[:MAX_PAGES_PER_FILE])


def _xml(archive, path):
	try:
		return ElementTree.fromstring(archive.read(path))
	except (KeyError, ElementTree.ParseError):
		return None


def _local(tag):
	return tag.rsplit("}", 1)[-1]


def extract_docx(content):
	"""Paragraphs of word/document.xml, sectioned at headings."""
	with zipfile.ZipFile(io.BytesIO(content)) as archive:
		root = _xml(archive, "word/document.xml")
	if root is None:
		fail(_("The Word file could not be read."))
	sections, current = [], []
	for paragraph in root.iter():
		if _local(paragraph.tag) != "p":
			continue
		style = ""
		text = []
		for node in paragraph.iter():
			name = _local(node.tag)
			if name == "pStyle":
				style = next((value for key, value in node.attrib.items() if _local(key) == "val"), "")
			elif name == "t" and node.text:
				text.append(node.text)
			elif name == "tab":
				text.append("\t")
			elif name in ("br", "cr"):
				text.append("\n")
		line = "".join(text).strip()
		if not line:
			continue
		heading = re.match(r"(?i)^(title|heading\s*([12]))$", style.replace("Heading", "Heading ").strip())
		if heading and current:
			sections.append("\n".join(current))
			current = []
		current.append(("# " + line) if heading else line)
	if current:
		sections.append("\n".join(current))
	return _pages(_chunk_sections(sections))


def extract_pptx(content):
	"""One page per slide, in slide order."""
	with zipfile.ZipFile(io.BytesIO(content)) as archive:
		names = [name for name in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)]
		names.sort(key=lambda name: int(re.search(r"(\d+)\.xml$", name).group(1)))
		slides = []
		for name in names[:MAX_PAGES_PER_FILE]:
			root = _xml(archive, name)
			lines = []
			for paragraph in root.iter() if root is not None else []:
				if _local(paragraph.tag) != "p":
					continue
				line = "".join(node.text or "" for node in paragraph.iter() if _local(node.tag) == "t").strip()
				if line:
					lines.append(line)
			slides.append("\n".join(lines))
	return _pages(slides)


def extract_text(content):
	"""Markdown or plain text, sectioned at level 1 and 2 headings."""
	if isinstance(content, bytes):
		content = content.decode("utf-8-sig", errors="replace")
	sections, current = [], []
	for line in content.splitlines():
		if re.match(r"^#{1,2}\s", line) and any(item.strip() for item in current):
			sections.append("\n".join(current))
			current = []
		current.append(line)
	if current:
		sections.append("\n".join(current))
	return _pages(_chunk_sections(sections))


EXTRACTORS = {
	"pdf": extract_pdf,
	"docx": extract_docx,
	"pptx": extract_pptx,
	"markdown": extract_text,
	"text": extract_text,
}


def file_kind(file_name):
	extension = (file_name or "").rsplit(".", 1)[-1].lower() if "." in (file_name or "") else ""
	return EXTENSIONS.get(extension)


def _file_doc(file_url):
	name = frappe.db.get_value("File", {"file_url": file_url}, "name")
	if not name:
		frappe.throw(_("File {0} not found.").format(file_url), frappe.DoesNotExistError)
	doc = frappe.get_doc("File", name)
	readable = doc.owner == frappe.session.user or frappe.has_permission("File", "read", doc=doc)
	if not (access.is_engine() or readable):
		frappe.throw(_("You cannot read the file {0}.").format(doc.file_name), frappe.PermissionError)
	return doc


def extract_source(row):
	"""Fill a Copilot Import Source row from its file. Errors stay on the row, not the import."""
	row.error = None
	try:
		doc = _file_doc(row.file_url)
		row.file_name = doc.file_name
		row.kind = file_kind(doc.file_name)
		if not row.kind:
			fail(_("{0}: only PDF, DOCX, PPTX, Markdown and text files are supported.").format(doc.file_name))
		if cint(doc.file_size) > MAX_FILE_BYTES:
			fail(_("{0} is larger than 25 MB.").format(doc.file_name))
		content = doc.get_content()
		if isinstance(content, str) and row.kind not in ("markdown", "text"):
			with open(doc.get_full_path(), "rb") as handle:
				content = handle.read()
		pages = EXTRACTORS[row.kind](content)
		if not pages:
			fail(_("No text found in {0}. Scanned documents need OCR first.").format(doc.file_name))
	except (zipfile.BadZipFile, ValueError) as error:
		pages = []
		row.error = _("The file could not be read: {0}").format(str(error)[:200])
	except frappe.ValidationError as error:
		pages = []
		row.error = str(error)[:500]
	row.pages = len(pages)
	row.chars = sum(len(page["text"]) for page in pages)
	row.pages_json = frappe.as_json(pages)
	return row


# ------------------------------------------------------------------ records


def assert_can_import():
	access.require_login()
	if not (access.is_engine() or access.TEACHER in access.audiences()):
		frappe.throw(_("Only teachers can create courses from documents."), frappe.PermissionError)


def get_import(name):
	name = existing("Copilot Course Import", name, _("Course import"))
	doc = frappe.get_doc("Copilot Course Import", name)
	if access.is_engine() or access.is_admin() or "Moderator" in access.roles():
		return doc
	if doc.requested_by != frappe.session.user:
		frappe.throw(_("This course import belongs to another teacher."), frappe.PermissionError)
	return doc


def source_ref(row):
	return f"S{row.idx}"


def upload_source(file_name, content):
	"""Store one document privately for the teacher.

	Frappe's own upload_file only accepts images, PDF, text and Office files from users
	without desk access, which rules out Markdown for most teachers.
	"""
	assert_can_import()
	file_name = required_text(file_name, _("File name"), 240)
	if not file_kind(file_name):
		fail(_("{0}: only PDF, DOCX, PPTX, Markdown and text files are supported.").format(file_name))
	if not content:
		fail(_("No file received."))
	if len(content) > MAX_FILE_BYTES:
		fail(_("{0} is larger than 25 MB.").format(file_name))
	doc = frappe.get_doc(
		{"doctype": "File", "file_name": file_name, "content": content, "is_private": 1, "folder": "Home"}
	).insert(ignore_permissions=True)
	return {"file_url": doc.file_url, "file_name": doc.file_name}


def create_import(title, files, brief=None):
	"""Store the files, extract their text and ask the Gateway for a course draft."""
	assert_can_import()
	title = required_text(title, _("Course title"), 140)
	brief = optional_text(brief, _("Brief"), 4000)
	files = parse_list(files, _("Files"), minimum=1, maximum=MAX_FILES)
	doc = frappe.get_doc(
		{
			"doctype": "Copilot Course Import",
			"title": title,
			"brief": brief,
			"status": "Draft",
			"requested_by": frappe.session.user,
		}
	)
	for file_url in files:
		doc.append("sources", {"file_url": required_text(file_url, _("File"), 500)})
	total = 0
	for row in doc.sources:
		extract_source(row)
		total += cint(row.chars)
	if total > MAX_IMPORT_CHARS:
		fail(_("The files hold {0} characters of text; the limit is {1}. Upload fewer files.").format(
			total, MAX_IMPORT_CHARS
		))
	doc.insert(ignore_permissions=True)
	for row in doc.sources:
		frappe.db.set_value("File", {"file_url": row.file_url}, {"attached_to_doctype": doc.doctype, "attached_to_name": doc.name})
	if not any(cint(row.pages) for row in doc.sources):
		_set_status(doc, "Failed", error=_("No text could be extracted from the files."))
		return serialise_import(doc)
	queue(doc)
	return serialise_import(doc)


def _set_status(doc, status, **values):
	doc.db_set({"status": status, **values})


def queue(doc):
	model = gateway.settings().default_model
	if not gateway.enqueue_course_import(doc.name):
		_set_status(doc, "Failed", error=_("The AI Gateway is not configured (Copilot Settings)."))
		return False
	_set_status(doc, "Queued", error=None, proposal=None, model=model)
	return True


def retry_import(name):
	assert_can_import()
	doc = get_import(name)
	if doc.proposal and frappe.db.get_value("Copilot Proposal", doc.proposal, "status") in ("Pending", "Applied"):
		fail(_("This import already has a course draft. Reject it first to draft again."))
	queue(doc)
	return serialise_import(doc)


def serialise_import(doc):
	proposal = None
	if doc.proposal:
		proposal = frappe.db.get_value(
			"Copilot Proposal", doc.proposal, ["name", "status", "title", "summary"], as_dict=True
		)
	return {
		"name": doc.name,
		"title": doc.title,
		"brief": doc.brief,
		"status": doc.status,
		"error": doc.error,
		"model": doc.model,
		"created": doc.creation,
		"requested_by": doc.requested_by,
		"course": doc.course,
		"proposal": proposal,
		"sources": [
			{
				"source": source_ref(row),
				"file_name": row.file_name,
				"file_url": row.file_url,
				"kind": row.kind,
				"unit": UNITS.get(row.kind or "", "section"),
				"pages": cint(row.pages),
				"chars": cint(row.chars),
				"error": row.error,
			}
			for row in doc.sources
		],
	}


def list_imports():
	assert_can_import()
	filters = {} if access.is_admin() or "Moderator" in access.roles() else {"requested_by": frappe.session.user}
	names = frappe.get_all(
		"Copilot Course Import", filters=filters, pluck="name", order_by="creation desc", limit=50
	)
	return [serialise_import(frappe.get_doc("Copilot Course Import", name)) for name in names]


# ------------------------------------------------------------------ tools for the Gateway


def get_import_sources(course_import):
	"""Extracted text of every file, page by page, for drafting the course."""
	doc = get_import(course_import)
	return {
		"course_import": doc.name,
		"title": doc.title,
		"brief": doc.brief,
		"status": doc.status,
		"sources": [
			{
				"source": source_ref(row),
				"file_name": row.file_name,
				"kind": row.kind,
				"unit": UNITS.get(row.kind or "", "section"),
				"pages": load_json(row.pages_json, []),
			}
			for row in doc.sources
			if cint(row.pages)
		],
	}


def record_import_error(course_import, error):
	"""The Gateway could not draft the course: show the teacher why."""
	doc = get_import(course_import)
	_set_status(doc, "Failed", error=required_text(error, _("Error"), 2000))
	return {"course_import": doc.name, "status": "Failed"}


def attach_proposal(course_import, proposal):
	doc = frappe.get_doc("Copilot Course Import", course_import)
	_set_status(doc, "Ready", proposal=proposal, error=None)


def page_index(doc):
	"""{source ref: (file name, unit, {page numbers})} for checking citations."""
	return {
		source_ref(row): (row.file_name, UNITS.get(row.kind or "", "section"), {page["page"] for page in load_json(row.pages_json, [])})
		for row in doc.sources
		if cint(row.pages)
	}


def mark_course_created(course_import, course):
	frappe.db.set_value("Copilot Course Import", course_import, {"course": course, "modified": now_datetime()})
