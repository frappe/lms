# Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

"""RediSearch backend for LMS search.

A drop-in alternative to :class:`lms.sqlite.LearningSearch` for deployments
where the SQLite FTS index cannot run — notably high-availability topologies
with ``sites/`` on a network filesystem, where SQLite's WAL mode requires shared
memory between all processes on one host and therefore breaks
(https://www.sqlite.org/wal.html).

Selected by ``LMS Settings.search_backend`` (default SQLite). It returns the same
result shape ``lms.command_palette`` consumes, so permission filtering and
grouping there are unaffected — only the storage engine changes.

The document preparation (including the Course Instructor -> parent
denormalisation and modified-date handling) is reused verbatim from
``LearningSearch`` so the indexed content is identical to the SQLite backend;
only storage/query is RediSearch-specific.

The redis-search client APIs are imported lazily inside the methods that use
them (as ``wiki`` does), so importing this module on a SQLite-only site — which
happens because ``hooks.py`` wires migration/scheduler/doc events here — never
requires ``redis.commands.search`` to be present.
"""

import re

import frappe
from frappe.utils.redis_wrapper import RedisWrapper

from lms.sqlite import LearningSearch, LearningSearchIndexMissingError

INDEX_NAME = "lms_learning_idx"
KEY_PREFIX = "lms_search:"

TEXT_FIELDS = ("title", "content")
TAG_FIELDS = (
	"doctype",
	"name",
	"published",
	"status",
	"company_name",
	"parent",
	"parenttype",
	"owner",
)
# stored (retrievable) but not queried as tags
DATE_FIELDS = ("start_date", "published_on", "creation")

# Doctypes whose child Course Instructor rows are denormalised onto them.
PARENT_DOCTYPES = ("LMS Course", "LMS Batch")

# RediSearch splits a TAG value on this character; use one that cannot occur in
# the indexed values so each value stays a single exact tag (see helpdesk).
TAG_SEPARATOR = "\n"

_UNSAFE_QUERY_CHARS = re.compile(r"[^a-zA-Z0-9\s]")
_TAG_SPECIAL = re.compile(r"([\s,.<>{}\[\]\"'\:;!@#$%^&*()\-+=~|/\\])")
_MIN_PREFIX_LEN = 3


def _response_error():
	from redis import ResponseError

	return ResponseError


def _index_definition_cls():
	try:
		from redis.commands.search.index_definition import IndexDefinition
	except ImportError:  # older redis-py
		from redis.commands.search.indexDefinition import IndexDefinition
	return IndexDefinition


def is_search_module_loaded() -> bool:
	"""True only if the RediSearch module is loaded in the cache Redis."""
	try:
		for module in frappe.cache().module_list():
			if module.get(b"name") == b"search":
				return True
	except Exception:
		return False
	return False


class LearningRediSearch:
	"""RediSearch-backed LMS search with the LearningSearch public surface."""

	def __init__(self):
		self.cache = frappe.cache()
		# Reuse LearningSearch purely for its ORM-based document preparation
		# (get_documents / prepare_document); no SQLite I/O happens here.
		self._domain = LearningSearch()

	def _index(self):
		return self.cache.ft(INDEX_NAME)

	def index_exists(self) -> bool:
		try:
			self._index().info()
			return True
		except Exception:
			return False

	def raise_if_not_indexed(self):
		if not self.index_exists():
			raise LearningSearchIndexMissingError(
				"Search index does not exist. Please build the index first."
			)

	def drop_index(self, delete_documents: bool = True):
		try:
			self._index().dropindex(delete_documents=delete_documents)
		except _response_error():
			pass

	def create_index(self):
		from redis.commands.search.field import NumericField, TagField, TextField

		schema = (
			[TextField(f) for f in TEXT_FIELDS]
			+ [TagField(f, separator=TAG_SEPARATOR) for f in TAG_FIELDS]
			+ [NumericField("modified", sortable=True)]
		)
		definition = _index_definition_cls()(prefix=[self.cache.make_key(KEY_PREFIX).decode()])
		self._index().create_index(schema, definition=definition)

	def build_index(self):
		if not is_search_module_loaded():
			frappe.log_error(
				title="LMS RediSearch",
				message="RediSearch module not loaded in cache Redis; index not built.",
			)
			return
		self.drop_index()
		self.create_index()
		for doc in self._domain.get_documents():
			self._store(doc)

	# --------------------------------------------------------------- document

	def _doc_key(self, doctype: str, name: str) -> str:
		return self.cache.make_key(f"{KEY_PREFIX}{doctype}:{name}").decode()

	def _to_hash(self, document: dict) -> dict:
		"""Flatten a LearningSearch document dict into a Redis hash mapping."""
		mapping = {f: "" for f in (*TEXT_FIELDS, *TAG_FIELDS, *DATE_FIELDS)}
		for field in (
			*TEXT_FIELDS,
			"doctype",
			"name",
			"status",
			"company_name",
			"parent",
			"parenttype",
			"owner",
		):
			mapping[field] = str(document.get(field) or "")
		mapping["published"] = "1" if document.get("published") else ""
		for field in DATE_FIELDS:
			value = document.get(field)
			mapping[field] = (
				value.isoformat() if hasattr(value, "isoformat") else (str(value) if value else "")
			)
		modified = document.get("modified")
		mapping["modified"] = str(modified) if modified else "0"
		return mapping

	def _store(self, doc):
		document = self._domain.prepare_document(doc)
		if not document:
			return
		# Key by the SOURCE doc's own identity, not the (possibly remapped) one in
		# the prepared document. A Course Instructor is denormalised onto its
		# parent course/batch (doctype/name fields point at the parent), but each
		# instructor keeps its own hash — so several instructors of one course all
		# stay searchable, and deleting one removes only its entry. command_palette
		# dedupes the shared parent name across these entries.
		key = self._doc_key(doc.doctype, doc.name)
		super(RedisWrapper, self.cache).hset(key, mapping=self._to_hash(document))

	def index_doc(self, doctype: str, name: str, ensure: bool = True):
		if ensure:
			self.raise_if_not_indexed()
		self._store(frappe.get_doc(doctype, name))

	def remove_doc(self, doctype: str, name: str):
		# delete_value applies make_key (the site prefix) to match the stored
		# hash key; the plain cache.delete() would target an unprefixed key.
		self.cache.delete_value(f"{KEY_PREFIX}{doctype}:{name}")

	@staticmethod
	def _escape_tag(value: str) -> str:
		return _TAG_SPECIAL.sub(r"\\\1", value)

	def drop_parent_entries(self, doctype: str, name: str):
		"""Delete every index entry denormalised onto (doctype, name) — the
		parent's own hash and any Course Instructor hashes pointing at it — by
		querying the search index itself rather than SQL, so it works even after
		the child rows have already been removed from the database.
		"""
		from redis.commands.search.query import Query

		clause = f"@doctype:{{{self._escape_tag(doctype)}}} @name:{{{self._escape_tag(name)}}}"
		try:
			raw = self._index().search(Query(clause).paging(0, 1000))
		except _response_error():
			return
		for entry in raw.docs:
			# entry.id is the full (already prefixed) Redis key.
			super(RedisWrapper, self.cache).delete(entry.id)

	# ----------------------------------------------------------------- search

	def _build_query_string(self, query: str) -> str:
		cleaned = _UNSAFE_QUERY_CHARS.sub(" ", query or "").strip().lower()
		cleaned = re.sub(r"\s+", " ", cleaned)
		terms = [f"{t}*" if len(t) >= _MIN_PREFIX_LEN else t for t in cleaned.split()]
		return f"({' '.join(terms)})" if terms else "*"

	def search(self, query: str):
		self.raise_if_not_indexed()
		query_string = self._build_query_string(query)
		# An empty / punctuation-only query yields "*" (match-all); return nothing
		# instead so the command palette never shows unrelated indexed documents.
		if query_string == "*":
			return {"results": []}

		from redis.commands.search.query import Query

		try:
			raw = self._index().search(Query(query_string).paging(0, 50))
		except _response_error() as e:
			frappe.log_error(title="LMS RediSearch query failed", message=str(e))
			return {"results": []}
		return {"results": [self._to_result(doc) for doc in raw.docs]}

	def _to_result(self, doc) -> dict:
		def get(f):
			return getattr(doc, f, "") or ""

		modified = get("modified")
		return {
			"doctype": get("doctype"),
			"name": get("name"),
			"title": get("title"),
			"content": get("content"),
			"author": get("owner"),
			"published": 1 if get("published") else 0,
			"start_date": get("start_date"),
			"status": get("status"),
			"company_name": get("company_name"),
			"modified": float(modified) if modified else 0,
		}


def build_index():
	"""Build the RediSearch LMS index — callable from console/scheduler."""
	LearningRediSearch().build_index()


# ------------------------------------------------------------------ lifecycle
# doc_event + scheduler handlers, gated on the toggle so they are inert unless
# the operator has switched LMS search to RediSearch.

_INDEXED_DOCTYPES = ("LMS Course", "LMS Batch", "Job Opportunity", "Course Instructor")


def _redisearch_selected() -> bool:
	return frappe.db.get_single_value("LMS Settings", "search_backend") == "RediSearch"


def _resync_parent(search, doctype, name):
	"""Rebuild a course/batch's entries from current state: drop every entry
	denormalised onto it (including instructor rows just removed from the child
	table, which leave no trash event), then re-index it and its current
	instructors."""
	search.drop_parent_entries(doctype, name)
	if not frappe.db.exists(doctype, name):
		return
	search.index_doc(doctype, name, ensure=False)
	for row in frappe.get_all(
		"Course Instructor",
		filters={"parenttype": doctype, "parent": name},
		pluck="name",
	):
		search.index_doc("Course Instructor", row, ensure=False)


def update_index(doc, method=None):
	if not _redisearch_selected():
		return
	search = LearningRediSearch()
	if not search.index_exists():
		return
	try:
		if doc.doctype in PARENT_DOCTYPES:
			# Editing a course/batch can add or remove instructors (child rows,
			# no per-row events), so rebuild all of its entries from current state.
			_resync_parent(search, doc.doctype, doc.name)
		else:
			# Standalone doc (Job Opportunity, or an instructor row changed on its
			# own) — refresh just its own entry.
			search.index_doc(doc.doctype, doc.name)
	except Exception:
		frappe.log_error(
			title="LMS RediSearch index update",
			message=f"Failed to index {doc.doctype}:{doc.name}",
		)


def delete_index(doc, method=None):
	if not _redisearch_selected():
		return
	search = LearningRediSearch()
	try:
		if doc.doctype in PARENT_DOCTYPES:
			# Drop the parent's own hash and all its denormalised instructor
			# hashes by querying the index (not SQL), so it holds even when the
			# child rows are already gone by the time this trash event runs.
			search.drop_parent_entries(doc.doctype, doc.name)
		else:
			# Every other source doc — including a standalone Course Instructor —
			# has its own hash keyed by its own identity.
			search.remove_doc(doc.doctype, doc.name)
	except Exception:
		frappe.log_error(
			title="LMS RediSearch index delete",
			message=f"Failed to remove {doc.doctype}:{doc.name}",
		)


def build_index_if_enabled():
	"""Scheduler entry: build the index if RediSearch is on and it is missing."""
	if not _redisearch_selected():
		return
	search = LearningRediSearch()
	if not search.index_exists():
		search.build_index()


def build_index_in_background():
	"""after_migrate entry: (re)build the index in the background if RediSearch is on."""
	if not _redisearch_selected():
		return
	if not frappe.cache().get_value("lms_redisearch_indexing_in_progress"):
		frappe.enqueue("lms.redisearch.build_index", queue="long")
