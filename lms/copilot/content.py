"""Read and change Course Lesson content stored as EditorJS JSON."""

import difflib
import hashlib
import json
import math
import re
import unicodedata

import frappe
from frappe import _
from frappe.utils import strip_html

from lms.copilot.validation import fail

EDITOR_VERSION = "2.29.0"
CONTEXT_LINES = 2


def parse_editor(content):
	if not content:
		return {"blocks": [], "version": EDITOR_VERSION}
	try:
		data = json.loads(content)
	except (TypeError, ValueError):
		fail(_("Lesson content is not valid EditorJS JSON."))
	if not isinstance(data, dict) or not isinstance(data.get("blocks"), list):
		fail(_("Lesson content is not a valid EditorJS document."))
	return data


def content_hash(content):
	return hashlib.sha256((content or "").encode()).hexdigest()[:16]


def _list_items(items, depth=0):
	lines = []
	for item in items or []:
		if isinstance(item, dict):
			lines.append("  " * depth + "- " + strip_html(str(item.get("content", ""))))
			lines.extend(_list_items(item.get("items"), depth + 1))
		else:
			lines.append("  " * depth + "- " + strip_html(str(item)))
	return lines


def block_text(block):
	"""Plain text of a block as a reader would see it; embeds become short markers."""
	kind = block.get("type")
	data = block.get("data") or {}
	if kind == "header":
		level = data.get("level") or 2
		return "#" * int(level) + " " + strip_html(str(data.get("text", "")))
	if kind in ("paragraph", "markdown"):
		text = str(data.get("text", ""))
		return strip_html(text) if kind == "paragraph" else text
	if kind == "list":
		return "\n".join(_list_items(data.get("items")))
	if kind == "code":
		return "```\n" + str(data.get("code", "")) + "\n```"
	if kind == "quiz":
		return f"[Quiz: {data.get('quiz', '')}]"
	if kind == "assignment":
		return f"[Assignment: {data.get('assignment', '')}]"
	if kind == "program":
		return f"[Programming exercise: {data.get('exercise', '')}]"
	if kind in ("embed", "upload", "image"):
		return "[Media]"
	return strip_html(json.dumps(data, ensure_ascii=False)) if data else ""


def lesson_sections(lesson_doc):
	"""Blocks of a lesson with the heading they sit under, for citations."""
	if lesson_doc.content:
		blocks = parse_editor(lesson_doc.content)["blocks"]
	elif lesson_doc.body:
		blocks = [{"id": "body", "type": "markdown", "data": {"text": lesson_doc.body}}]
	else:
		blocks = []

	sections = []
	heading = None
	for block in blocks:
		text = block_text(block).strip()
		if not text:
			continue
		if block.get("type") == "header" or (block.get("type") == "markdown" and text.startswith("#")):
			heading = text.splitlines()[0].lstrip("#").strip()
		sections.append(
			{"block_id": block.get("id"), "type": block.get("type"), "heading": heading, "text": text}
		)
	return sections


def lesson_text(lesson_doc):
	return "\n\n".join(section["text"] for section in lesson_sections(lesson_doc))


def markdown_block(markdown):
	return {"id": frappe.generate_hash(length=10), "type": "markdown", "data": {"text": markdown}}


def append_block(content, block, after_block=None):
	data = parse_editor(content)
	blocks = data["blocks"]
	if after_block:
		index = next((i for i, item in enumerate(blocks) if item.get("id") == after_block), None)
		if index is None:
			fail(_("The lesson has no block {0}.").format(after_block))
		blocks.insert(index + 1, block)
	else:
		blocks.append(block)
	return frappe.as_json(data)


def replace_block(content, block_id, markdown):
	data = parse_editor(content)
	for index, item in enumerate(data["blocks"]):
		if item.get("id") == block_id:
			data["blocks"][index] = {"id": block_id, "type": "markdown", "data": {"text": markdown}}
			return frappe.as_json(data)
	fail(_("The lesson has no block {0}.").format(block_id))


def text_diff(before, after):
	"""Line diff for review screens: unchanged runs are trimmed to a little context."""
	before_lines = (before or "").splitlines()
	after_lines = (after or "").splitlines()
	matcher = difflib.SequenceMatcher(a=before_lines, b=after_lines, autojunk=False)
	lines = []
	for tag, i1, i2, j1, j2 in matcher.get_opcodes():
		if tag == "equal":
			chunk = before_lines[i1:i2]
			if len(chunk) > CONTEXT_LINES * 2:
				head = chunk[:CONTEXT_LINES] if lines else []
				tail = chunk[-CONTEXT_LINES:] if i2 < len(before_lines) or j2 < len(after_lines) else []
				lines.extend({"op": "same", "text": text} for text in head)
				lines.append(
					{"op": "skip", "text": f"… {len(chunk) - len(head) - len(tail)} unchanged lines"}
				)
				lines.extend({"op": "same", "text": text} for text in tail)
			else:
				lines.extend({"op": "same", "text": text} for text in chunk)
			continue
		lines.extend({"op": "del", "text": text} for text in before_lines[i1:i2])
		lines.extend({"op": "add", "text": text} for text in after_lines[j1:j2])
	return lines


def fold(text):
	"""Lowercase, accent-free text so Vietnamese queries match with or without diacritics."""
	text = unicodedata.normalize("NFD", (text or "").lower()).replace("đ", "d")
	return "".join(char for char in text if unicodedata.category(char) != "Mn")


def terms(text):
	return [term for term in re.findall(r"[a-z0-9_]+", fold(text)) if len(term) > 1]


# Common Vietnamese function words (accent-folded) that carry no topic. Learner questions are
# full of them ("em", "thì", "ở đâu"), and without this list they outweigh words like "try".
# Folding merges words such as dừng/dùng/đúng into "dung", so ambiguous content words stay in.
STOPWORDS = frozenset(
	"""
	em anh chi ban minh toi thay co cac nhung mot nay kia do day the thi la ma va voi cua cho
	de o dau khi nao gi sao tai vi vay nen lam duoc bi da dang se roi hay hoac hon nhu cung
	con chua khong phai can muon hoi giup oi a ah nhe nha vao ra len xuong tu den trong ngoai
	sau truoc ve theo boi rang neu thuc su bang nhieu it moi chi dat
	""".split()
)


def search_terms(text):
	"""Terms used for ranking: :func:`terms` without Vietnamese function words."""
	return [term for term in terms(text) if term not in STOPWORDS]


def rank_sections(query, sections):
	"""Score sections against a query, weighting rare terms higher (IDF over these sections).

	Returns ``(score, section)`` pairs, best first, for sections sharing at least one term.
	The score is the share of the query's IDF weight the section covers, plus 1 when the
	whole query appears verbatim, so 0.5 means "covers half of what the question is about".
	"""
	query_terms = set(search_terms(query))
	if not query_terms or not sections:
		return []
	haystacks = [fold((section.get("heading") or "") + " " + (section.get("text") or "")) for section in sections]
	section_terms = [set(terms(haystack)) for haystack in haystacks]
	total = len(sections)
	idf = {
		term: math.log(1 + total / (1 + sum(1 for found in section_terms if term in found)))
		for term in query_terms
	}
	weight = sum(idf.values())
	folded_query = fold(query)
	ranked = []
	for section, haystack, found in zip(sections, haystacks, section_terms):
		overlap = query_terms & found
		if not overlap:
			continue
		score = sum(idf[term] for term in overlap) / weight
		if folded_query in haystack:
			score += 1
		ranked.append((score, section))
	ranked.sort(key=lambda item: item[0], reverse=True)
	return ranked
