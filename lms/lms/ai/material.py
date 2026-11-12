"""A goal's material: reading uploaded files into its knowledge base, and reporting how far reading got."""

import json
import os
import re
import time

import frappe
from frappe import _
from frappe.utils import cint

PAGE_TITLE = "{file} · p.{page}"
SOURCE_DOCTYPE = "Flow Knowledge Source"
READING_CACHE = "lms_goal_reading"
# Free embedding plans allow about 100 chunks a minute, so a long PDF runs into the limit.
# Waiting it out is cheaper than failing the whole file.
RATE_LIMIT_WAITS = 6
RATE_LIMIT_PAUSE = 30
RATE_LIMITED = re.compile(r"429|rate.?limit|quota", re.IGNORECASE)


def add_sources(goal: str, file_urls: list[str]) -> None:
	"""Read files in the background, one at a time, so a long PDF neither blocks the request
	nor races other files for the provider's per-minute limit."""
	for file_url in file_urls:
		file = frappe.get_doc("File", {"file_url": file_url})
		_remember_source_file(goal, _document_name(file), file_url)
		set_reading(goal, _document_name(file), 0, 0)
	frappe.enqueue(
		"lms.lms.ai.material.read_sources",
		queue="long",
		timeout=60 * 60,
		enqueue_after_commit=True,
		goal=goal,
		file_urls=file_urls,
	)


def add_url(goal: str, url: str) -> None:
	"""Read a web page in the background: one page, cited by its title, opened at its address."""
	given, url = url.strip(), _final_address(url)
	urls = source_urls(goal)
	# Try again on a page keeps its name and place; a new address gets a name of its own.
	title = next((t for t, u in urls.items() if u in (given, url)), None) or _unique_document(
		goal, _page_title(url)
	)
	urls[title] = url
	frappe.db.set_value("LMS Goal", goal, "source_urls", json.dumps(urls))
	set_reading(goal, title, 0, 0)
	frappe.enqueue(
		"lms.lms.ai.material.read_url",
		queue="long",
		timeout=15 * 60,
		enqueue_after_commit=True,
		goal=goal,
		url=url,
		title=title,
	)


def read_url(goal: str, url: str, title: str) -> None:
	"""Worker: fetch the page and index it. Flow keeps a failed page with its reason."""
	from frappe.flow.knowledge.knowledge import Knowledge

	try:
		kb = Knowledge(frappe.db.get_value("LMS Goal", goal, "knowledge_base"))
		_drop_title(kb.name, title)
		kb.add_url(url, title=title)
	except Exception:
		frappe.log_error(title="Web page could not be read as material")
	finally:
		clear_reading(goal, [title])
		frappe.publish_realtime(
			"lms_goal_material",
			{"goal": goal},
			user=frappe.db.get_value("LMS Goal", goal, "owner"),
			after_commit=True,
		)


def source_urls(goal: str) -> dict[str, str]:
	return json.loads(frappe.db.get_value("LMS Goal", goal, "source_urls") or "{}")


def _public_url(url: str) -> str:
	"""An http(s) address on the public internet; Flow refuses anything else when it reads it, and
	refusing here keeps the title fetch to the same rule."""
	from frappe.utils import validate_url

	url = (url or "").strip()
	if not validate_url(url, valid_schemes=("http", "https")):
		frappe.throw(_("Enter a full web address, starting with https://."))
	try:
		from frappe.flow.knowledge.extract import _validate_public_url

		_validate_public_url(url)
	except ImportError:
		pass
	return url


def _final_address(url: str) -> str:
	"""Where the address really leads: Flow refuses a page that redirects, so follow the redirects
	here, checking each step is still a public address, and keep the last one."""
	import requests

	url = _public_url(url)
	for _hop in range(5):
		try:
			response = requests.head(
				url, timeout=15, allow_redirects=False, headers={"User-Agent": "Flow-Knowledge/1.0"}
			)
		except requests.RequestException:
			return url
		if not response.is_redirect or not response.headers.get("Location"):
			return url
		url = _public_url(requests.compat.urljoin(url, response.headers["Location"]))
	return url


def _page_title(url: str) -> str:
	"""The page's own title, else its last path part and host: "Sales Invoice · docs.frappe.io"."""
	from urllib.parse import urlparse

	import requests

	parts = urlparse(url)
	slug = [part for part in parts.path.split("/") if part]
	words = re.sub(r"[-_]+", " ", slug[-1]).strip().title() if slug else ""
	fallback = f"{words} · {parts.hostname}" if words else (parts.hostname or url)
	try:
		response = requests.get(
			url, timeout=15, stream=True, allow_redirects=False, headers={"User-Agent": "Flow-Knowledge/1.0"}
		)
		if not response.ok or "html" not in response.headers.get("Content-Type", "").lower():
			return fallback[:140]
		head = response.raw.read(256 * 1024, decode_content=True).decode("utf-8", errors="ignore")
	except Exception:
		return fallback[:140]
	match = re.search(r"<title[^>]*>(.*?)</title>", head, re.IGNORECASE | re.DOTALL)
	title = re.sub(r"\s+", " ", frappe.utils.strip_html_tags(match.group(1))).strip() if match else ""
	return (title or fallback)[:140]


def _unique_document(goal: str, title: str) -> str:
	"""Citations find a document by its title, so two sources never share one."""
	from lms.lms.ai.goals import documents

	taken = set(documents(frappe.get_doc("LMS Goal", goal)))
	candidate, n = title, 2
	while candidate in taken:
		candidate, n = f"{title} ({n})", n + 1
	return candidate


def read_sources(goal: str, file_urls: list[str]) -> None:
	"""Worker: index each file, a PDF one page per source so answers can cite the page."""
	from frappe.flow.knowledge.knowledge import Knowledge

	kb = Knowledge(frappe.db.get_value("LMS Goal", goal, "knowledge_base"))
	files = [frappe.get_doc("File", {"file_url": file_url}) for file_url in file_urls]
	try:
		for file in files:
			Reader(goal, kb, file).read()
	finally:
		clear_reading(goal, [_document_name(file) for file in files])
		frappe.publish_realtime(
			"lms_goal_material",
			{"goal": goal},
			user=frappe.db.get_value("LMS Goal", goal, "owner"),
			after_commit=True,
		)


class Reader:
	def __init__(self, goal: str, kb, file) -> None:
		self.goal = goal
		self.kb = kb
		self.file = file
		self.document = _document_name(file)

	def read(self) -> None:
		parts = self.parts()
		done = set(
			frappe.get_all(
				SOURCE_DOCTYPE,
				filters={"knowledge_base": self.kb.name, "status": "Completed"},
				pluck="title",
			)
		)
		for index, (title, text) in enumerate(parts, 1):
			set_reading(self.goal, self.document, index, len(parts))
			if title in done:
				continue
			if not self.add(title, text):
				return

	def parts(self) -> list[tuple[str, str | None]]:
		if not self.file.file_name.lower().endswith(".pdf"):
			return [(self.document, None)]
		return [
			(PAGE_TITLE.format(file=self.document, page=number), text)
			for number, text in _pdf_pages(self.file.get_content())
		]

	def add(self, title: str, text: str | None) -> bool:
		return index_part(self.kb, title, text=text, file_url=None if text else self.file.file_url)


def index_part(kb, title: str, text: str | None = None, file_url: str | None = None) -> bool:
	"""Index one part, waiting out the provider's per-minute limit. False stops the document."""
	for attempt in range(RATE_LIMIT_WAITS + 1):
		_drop_title(kb.name, title)
		try:
			if text is None:
				kb.add_file(file_url, title=title)
			else:
				kb.add_text(text, title=title)
			frappe.db.commit()  # each page shows as read while the rest continue; nosemgrep: frappe-manual-commit
			return True
		except Exception as e:
			frappe.db.commit()  # keep the failed source so the panel can say why; nosemgrep: frappe-manual-commit
			if not RATE_LIMITED.search(str(e)):
				return True  # only this part is unreadable; the rest may be fine
			if attempt < RATE_LIMIT_WAITS:
				time.sleep(RATE_LIMIT_PAUSE)
	return False


def _drop_title(kb: str, title: str) -> None:
	for name in frappe.get_all(SOURCE_DOCTYPE, filters={"knowledge_base": kb, "title": title}, pluck="name"):
		# nosemgrep: lms-unjustified-ignore-permissions - knowledge sources belong to the skill's own knowledge base, not to a user
		frappe.delete_doc(SOURCE_DOCTYPE, name, force=True, ignore_permissions=True)


def remove_source(goal: str, document: str) -> None:
	"""Forget a document: every page of it leaves the knowledge base, so the tutor stops citing it."""
	if document in reading_progress(goal):
		frappe.throw(_("This file is still being read. Remove it once reading finishes."))
	from lms.lms.ai.course_material import remove_course

	if remove_course(goal, document):
		return
	kb = frappe.db.get_value("LMS Goal", goal, "knowledge_base")
	if kb:
		page_prefix = PAGE_TITLE.format(file=document, page="")
		for name, title in frappe.get_all(
			SOURCE_DOCTYPE, filters={"knowledge_base": kb}, fields=["name", "title"], as_list=True
		):
			if title == document or title.startswith(page_prefix):
				# nosemgrep: lms-unjustified-ignore-permissions - knowledge sources belong to the skill's own knowledge base, not to a user
				frappe.delete_doc(SOURCE_DOCTYPE, name, force=True, ignore_permissions=True)
	files = json.loads(frappe.db.get_value("LMS Goal", goal, "source_files") or "{}")
	if files.pop(document, None) is not None:
		frappe.db.set_value("LMS Goal", goal, "source_files", json.dumps(files))
	urls = source_urls(goal)
	if urls.pop(document, None) is not None:
		frappe.db.set_value("LMS Goal", goal, "source_urls", json.dumps(urls))


def goal_sources(goal: str) -> list[dict]:
	"""One entry per uploaded document, with its pages, status and reading progress."""
	from lms.lms.ai.goals import friendly_error

	kb = frappe.db.get_value("LMS Goal", goal, "knowledge_base")
	if not kb:
		return []
	rows = frappe.get_all(
		SOURCE_DOCTYPE,
		filters={"knowledge_base": kb},
		fields=["title", "status", "chunk_count", "error_log"],
		order_by="creation asc",
	)
	from lms.lms.ai.course_material import course_documents

	courses = course_documents(goal)
	documents: dict[str, dict] = {}
	for document, course in courses.items():
		_entry(documents, document).update(empty=True, **course)
	for document, url in source_urls(goal).items():
		_entry(documents, document).update(url=url)
	for row in rows:
		entry = _entry(documents, _document_of(row.title, courses))
		entry.pop("empty", None)
		entry["pages"] += 1
		entry["chunks"] += cint(row.chunk_count)
		if row.status != "Completed":
			entry["status"] = row.status
			entry["error"] = friendly_error(row.error_log)
	for document, progress in reading_progress(goal).items():
		entry = _entry(documents, document)
		entry.update(status="Reading", error=None, page=progress["page"], total=progress["total"])
	return list(documents.values())


def _document_of(title: str, courses: dict[str, str]) -> str:
	"""The document a knowledge base entry belongs to: a course for a lesson, a file for a page."""
	course = next((document for document in courses if title.startswith(f"{document} · ")), None)
	return course or title.split(" · p.")[0]


def is_reading(goal: str) -> bool:
	return bool(reading_progress(goal))


def reading_progress(goal: str) -> dict[str, dict]:
	return frappe.cache.get_value(f"{READING_CACHE}:{goal}") or {}


def excerpt(goal: str, document: str, page: int | None, near: str = "", length: int = 420) -> str | None:
	"""The passage of a cited page closest to the sentence that cited it."""
	kb = frappe.db.get_value("LMS Goal", goal, "knowledge_base")
	title = PAGE_TITLE.format(file=document, page=page) if page else document
	source = frappe.db.get_value(SOURCE_DOCTYPE, {"knowledge_base": kb, "title": title})
	if not source:
		return None
	chunks = frappe.get_all(
		"Flow Knowledge Chunk", filters={"source": source}, pluck="content", order_by="chunk_index asc"
	)
	if not chunks:
		return None
	words = set(re.findall(r"\w{4,}", near.lower()))
	best = max(chunks, key=lambda chunk: len(words & set(re.findall(r"\w{4,}", chunk.lower()))))
	sentences = re.split(r"(?<=[.!?])\s+", " ".join(best.split()))
	start = max(
		range(len(sentences)), key=lambda i: len(words & set(re.findall(r"\w{4,}", sentences[i].lower())))
	)
	text = " ".join(sentences[start:])
	return text if len(text) <= length else text[:length].rsplit(" ", 1)[0] + "…"


def source_url(goal: str, document: str) -> str | None:
	"""The web page a citation's document title came from."""
	return source_urls(goal).get(document)


def source_file_url(goal: str, document: str) -> str | None:
	"""The uploaded file a citation's document title came from."""
	return json.loads(frappe.db.get_value("LMS Goal", goal, "source_files") or "{}").get(document)


def _entry(documents: dict[str, dict], document: str) -> dict:
	return documents.setdefault(
		document, {"title": document, "pages": 0, "chunks": 0, "status": "Completed", "error": None}
	)


def set_reading(goal: str, document: str, page: int, total: int) -> None:
	progress = reading_progress(goal)
	progress[document] = {"page": page, "total": total}
	frappe.cache.set_value(f"{READING_CACHE}:{goal}", progress, expires_in_sec=2 * 60 * 60)


def clear_reading(goal: str, documents: list[str]) -> None:
	progress = {
		document: step for document, step in reading_progress(goal).items() if document not in documents
	}
	if progress:
		frappe.cache.set_value(f"{READING_CACHE}:{goal}", progress, expires_in_sec=2 * 60 * 60)
	else:
		frappe.cache.delete_value(f"{READING_CACHE}:{goal}")


def _remember_source_file(goal: str, title: str, file_url: str) -> None:
	files = json.loads(frappe.db.get_value("LMS Goal", goal, "source_files") or "{}")
	files[title] = file_url
	frappe.db.set_value("LMS Goal", goal, "source_files", json.dumps(files))


def _document_name(file) -> str:
	return os.path.splitext(file.file_name)[0]


def _pdf_pages(content: bytes) -> list[tuple[int, str]]:
	import io

	import pdfplumber

	with pdfplumber.open(io.BytesIO(content)) as pdf:
		pages = [(number, (page.extract_text() or "").strip()) for number, page in enumerate(pdf.pages, 1)]
	return [(number, text) for number, text in pages if text]
