from contextlib import suppress

import frappe
from frappe.search.sqlite_search import SQLiteSearch, SQLiteSearchIndexMissingError
from frappe.utils import nowdate


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
	}

	DOCTYPE_FIELDS = {
		"LMS Course": [
			"name",
			"title",
			"description",
			"short_introduction",
			"category",
			"creation",
			"modified",
			"owner",
		],
		"LMS Batch": [
			"name",
			"title",
			"description",
			"batch_details",
			"category",
			"creation",
			"modified",
			"owner",
		],
		"Job Opportunity": [
			"name",
			"job_title",
			"company_name",
			"description",
			"creation",
			"modified",
			"owner",
		],
	}

	def build_index(self):
		try:
			super().build_index()
		except Exception as e:
			frappe.throw(e)

	def get_search_filters(self):
		return {}

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
