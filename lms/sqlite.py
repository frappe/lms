from contextlib import suppress

import frappe
from frappe.search.sqlite_search import SQLiteSearch, SQLiteSearchIndexMissingError
from frappe.utils import update_progress_bar
from redis.exceptions import ResponseError


class LearningSearch(SQLiteSearch):
	INDEX_NAME = "learning.db"

	INDEX_SCHEMA = {
		"metadata_fields": ["category", "owner", "published"],
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
	}

	def can_create_course(self, roles):
		return "Course Creator" in roles or "Moderator" in roles

	def can_create_batch(self, roles):
		return "Batch Evaluator" in roles or "Moderator" in roles

	def get_records(self, doctype):
		records = []
		roles = frappe.get_roles()
		filters = {}

		if doctype == "LMS Course":
			if not self.can_create_course(roles):
				filters = {"published": 1}

		if doctype == "LMS Batch":
			if not self.can_create_batch(roles):
				filters = {"published": 1}

		records = frappe.db.get_all(doctype, filters=filters, fields=self.DOCTYPE_FIELDS[doctype])
		for record in records:
			record["doctype"] = doctype

		return records

	def build_index(self):
		try:
			super().build_index()
		except Exception as e:
			frappe.throw(e)

	def get_search_filters(self):
		roles = frappe.get_roles()
		if not (self.can_create_course(roles) and self.can_create_batch(roles)):
			return {"published": 1}
		return {}


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
