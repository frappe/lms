from contextlib import suppress

import frappe
from frappe.search.sqlite_search import SQLiteSearch, SQLiteSearchIndexMissingError
from frappe.utils import get_datetime, nowdate


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
		"Course Instructor": {
			"fields": [
				"name",
				{"title": "instructor"},
				{"content": "instructor"},
				"parent",
				"parenttype",
				"modified",
			]
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
		"Course Instructor": [
			"name",
			"instructor",
			"parent",
			"parenttype",
		],
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

		if doc.doctype == "Course Instructor":
			instructor = frappe.db.get_value("User", doc.instructor, "full_name")
			if doc.parenttype == "LMS Course":
				details = frappe.db.get_value(
					"LMS Course",
					doc.parent,
					["name", "title", "description", "published_on", "modified", "published"],
					as_dict=True,
				)
				document["published_on"] = details.get("published_on")
			elif doc.parenttype == "LMS Batch":
				details = frappe.db.get_value(
					"LMS Batch",
					doc.parent,
					["name", "title", "batch_details as description", "start_date", "modified", "published"],
					as_dict=True,
				)
				document["start_date"] = details.get("start_date")

			if details:
				document["doctype"] = doc.parenttype
				document["name"] = doc.parent
				document["title"] = self._process_content(details.title)
				document["content"] = self._process_content(
					f"Instructor: {instructor}\n{details.description}\n{doc.instructor}"
				)
				document["modified"] = self.get_modified_date(details, doc.parenttype)
				document["published"] = details.get("published", 0)

		else:
			if not document.get("modified"):
				document["modified"] = self.get_modified_date(doc, doc.doctype)

		return document

	def get_modified_date(self, details, doctype):
		modified_value = None
		if doctype == "LMS Course":
			modified_value = details.get("published_on")
		elif doctype == "LMS Batch":
			modified_value = details.get("start_date")

		if not modified_value:
			modified_value = frappe.db.get_value(doctype, details.name, "creation")
			print(details.name, modified_value)

		modified_value = get_datetime(modified_value)
		print(modified_value)
		modified_value = modified_value.timestamp()
		print(modified_value)
		return modified_value

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
