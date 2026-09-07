from contextlib import suppress

import frappe
from frappe.search.sqlite_search import SQLiteSearch, SQLiteSearchIndexMissingError
from frappe.utils import get_datetime, getdate, nowdate


class LearningSearch(SQLiteSearch):
	INDEX_NAME = "learning.db"

	INDEX_SCHEMA = {
		"metadata_fields": [
			"owner",
			"published",
			"published_on",
			"start_date",
			"status",
			"company_name",
			"creation",
			"parent",
			"parenttype",
		],
		"tokenizer": "unicode61 remove_diacritics 2 tokenchars '-_'",
	}

	INDEXABLE_DOCTYPES = {
		"LMS Course": {
			"fields": [
				"name",
				"title",
				{"content": "description"},
				"short_introduction",
				"published",
				"category",
				"owner",
				{"modified": "published_on"},
			],
		},
		"LMS Batch": {
			"fields": [
				"name",
				"title",
				"description",
				{"content": "batch_details"},
				"published",
				"category",
				"owner",
				{"modified": "start_date"},
			],
		},
		"Job Opportunity": {
			"fields": [
				"name",
				{"title": "job_title"},
				{"content": "description"},
				"owner",
				"location",
				"country",
				"company_name",
				"status",
				"creation",
				{"modified": "creation"},
			],
		},
		# Quizzes and programs carry no prose of their own, so the title doubles as
		# the content field the index requires.
		"LMS Quiz": {
			"fields": [
				"name",
				"title",
				{"content": "title"},
				"owner",
				"modified",
			],
		},
		"LMS Assignment": {
			"fields": [
				"name",
				"title",
				{"content": "question"},
				"owner",
				"modified",
			],
		},
		"LMS Program": {
			"fields": [
				"name",
				"title",
				{"content": "title"},
				"published",
				"owner",
				"modified",
			],
		},
	}

	COURSE_FIELDS = [
		"name",
		"title",
		"description",
		"short_introduction",
		"category",
		"published",
		"published_on",
		"creation",
		"modified",
		"owner",
	]

	BATCH_FIELDS = [
		"name",
		"title",
		"description",
		"batch_details",
		"category",
		"start_date",
		"creation",
		"modified",
		"owner",
		"published",
	]

	JOB_FIELDS = [
		"name",
		"job_title",
		"company_name",
		"description",
		"creation",
		"modified",
		"owner",
	]

	DOCTYPE_FIELDS = {
		"LMS Course": COURSE_FIELDS,
		"LMS Batch": BATCH_FIELDS,
		"Job Opportunity": JOB_FIELDS,
	}

	def build_index(self):
		try:
			super().build_index()
		except Exception as e:
			frappe.throw(e)

	def get_search_filters(self):
		return {}

	def prepare_document(self, doc):
		document = super().prepare_document(doc)
		if not document:
			return None

		if not document.get("modified"):
			self.set_modified_date(doc, doc.doctype, document)

		return document

	def set_modified_date(self, details, doctype, document):
		modified_value = None
		if doctype == "LMS Course":
			modified_value = details.get("published_on")
		elif doctype == "LMS Batch":
			modified_value = details.get("start_date")

		if not modified_value:
			modified_value = frappe.db.get_value(doctype, details.name, "creation")

		modified_value = get_datetime(modified_value)
		if doctype == "LMS Course":
			document["published_on"] = getdate(modified_value)
		elif doctype == "LMS Batch":
			document["start_date"] = getdate(modified_value)

		document["modified"] = modified_value.timestamp()

	@SQLiteSearch.scoring_function
	def get_doctype_boost(self, row, query, query_words):
		doctype = row["doctype"]
		if doctype == "LMS Course":
			if row["published"]:
				return 1.3
		elif doctype == "LMS Batch":
			if row["published"] and row["start_date"] >= nowdate():
				return 1.3
			elif row["published"]:
				return 1.2
		return 1.0


class LearningSearchIndexMissingError(SQLiteSearchIndexMissingError):
	pass


def build_index():
	search = LearningSearch()
	search.build_index()


def build_index_in_background():
	if not frappe.cache().get_value("learning_search_indexing_in_progress"):
		frappe.enqueue(build_index, queue="long")


def build_index_if_not_exists():
	search = LearningSearch()
	if not search.index_exists():
		build_index()
