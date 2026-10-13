# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import io
import json
import zipfile

import frappe

from lms.lms.course_import_export import (
	build_assessment_doc,
	create_supporting_docs,
	frappe_json_dumps,
)
from lms.lms.test_helpers import BaseTestUtils

# The four doctypes that carry `authors`, each with the smallest payload that
# survives its own validate(). Built here rather than through the shared
# _create_* helpers because those reuse a fixture by title, and a reused row was
# inserted by whoever made it first — which is the one thing every assertion
# below is about.
AUTHORED_DOCTYPES = ("LMS Quiz", "LMS Programming Exercise", "LMS Assignment", "LMS Question")


def minimal_payload(doctype, suffix):
	"""The smallest payload of each doctype that survives its own validate()."""
	if doctype == "LMS Quiz":
		return {"title": f"Authors Quiz {suffix}", "passing_percentage": 70, "total_marks": 0}
	if doctype == "LMS Programming Exercise":
		return {
			"title": f"Authors Exercise {suffix}",
			"language": "Python",
			"problem_statement": "<p>Add two numbers.</p>",
			"test_cases": [{"input": "1 2", "expected_output": "3"}],
		}
	if doctype == "LMS Assignment":
		return {
			"title": f"Authors Assignment {suffix}",
			"type": "Text",
			"question": "<p>Explain yourself.</p>",
		}
	return {
		"question": f"Authors Question {suffix}?",
		"type": "Choices",
		"option_1": "Option 1",
		"is_correct_1": 1,
		"option_2": "Option 2",
		"is_correct_2": 0,
	}


def authors_of(doctype, name):
	return [row.author for row in frappe.get_doc(doctype, name).authors]


class TestContentAuthors(BaseTestUtils):
	"""Lives in lms/tests/security/ rather than beside the doctype on purpose.

	IntegrationTestCase.setUpClass infers `cls.doctype` from a test module sitting in
	a doctype folder and calls make_test_records on it, which walks that doctype's
	link dependencies transitively and imports every dependency's own test module --
	reaching ERPNext's and trying to create a Fiscal Year that collides with the one
	the site already has. Nothing here needs a generated test record; the fixtures are
	built in setUp.

	Nothing here asserts a permission, because after this commit none has moved. What
	the suite pins is the two facts the gate will be written against: a new row names
	its inserter, and a row from before the field existed names nobody, so the
	predicate has to fall back to `owner` -- which is what makes shipping no backfill
	patch safe.
	"""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.hash = frappe.generate_hash(length=6)
		self.author = self._create_user(f"ca-a-{self.hash}@example.com", "Ann", "Author", ["Course Creator"])
		self.colleague = self._create_user(
			f"ca-b-{self.hash}@example.com", "Bo", "Colleague", ["Course Creator"]
		)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _insert(self, doctype, as_user, authors=None):
		"""Inserted as the actor, through the ordinary permission path.

		Both actors hold Course Creator, which grants create and write on all four,
		so nothing here needs ignore_permissions — and a save that stopped working
		for a legitimate author would fail rather than be waved through.
		"""
		frappe.set_user(as_user)
		payload = {"doctype": doctype, **minimal_payload(doctype, self.hash)}
		if authors is not None:
			payload["authors"] = [{"author": name} for name in authors]
		doc = frappe.get_doc(payload).insert()
		frappe.set_user("Administrator")
		return doc

	def test_the_field_is_the_same_shape_on_every_authored_doctype(self):
		"""One child doctype, one fieldname, one fieldtype — four parents.

		A parent that drifts to a Link, or to its own child doctype, reads the same
		on a form and cannot be gated by one predicate.
		"""
		child = frappe.get_meta("LMS Content Author")
		self.assertTrue(child.istable, "LMS Content Author must be a child doctype")
		self.assertEqual([field.fieldname for field in child.fields], ["author"])
		self.assertEqual(child.get_field("author").fieldtype, "Link")
		self.assertEqual(child.get_field("author").options, "User")

		for doctype in AUTHORED_DOCTYPES:
			with self.subTest(doctype=doctype):
				field = frappe.get_meta(doctype).get_field("authors")
				self.assertIsNotNone(field, f"{doctype} has no `authors` field")
				self.assertEqual(field.fieldtype, "Table MultiSelect")
				self.assertEqual(field.options, "LMS Content Author")
				self.assertFalse(field.reqd, "reqd would block every save of a row from before the field")

	def test_an_insert_that_names_nobody_names_its_inserter(self):
		for doctype in AUTHORED_DOCTYPES:
			with self.subTest(doctype=doctype):
				doc = self._insert(doctype, self.author.name)
				self.assertEqual(authors_of(doctype, doc.name), [self.author.name])
				self.assertEqual(frappe.db.get_value(doctype, doc.name, "owner"), self.author.name)

	def test_an_insert_that_names_someone_keeps_exactly_who_it_named(self):
		"""The inserter is a default, not an addition.

		Seeding on top of a named list would silently make every colleague who
		files something on another author's behalf a second author of it.
		"""
		for doctype in AUTHORED_DOCTYPES:
			with self.subTest(doctype=doctype):
				doc = self._insert(doctype, self.author.name, authors=[self.colleague.name])
				self.assertEqual(authors_of(doctype, doc.name), [self.colleague.name])
				self.assertEqual(frappe.db.get_value(doctype, doc.name, "owner"), self.author.name)

	def test_a_second_author_added_afterwards_survives_the_save(self):
		"""Asserted after a reload, not on the in-memory doc.

		A child row that never reached the table leaves the doc in hand looking
		right, so an assertion on `doc.authors` here passes whether or not the row
		was written.
		"""
		for doctype in AUTHORED_DOCTYPES:
			with self.subTest(doctype=doctype):
				doc = self._insert(doctype, self.author.name)
				doc.append("authors", {"author": self.colleague.name})
				doc.save()
				self.assertEqual(authors_of(doctype, doc.name), [self.author.name, self.colleague.name])

	def test_a_reassignment_that_drops_the_inserter_is_not_undone_by_a_later_save(self):
		"""The seed runs on insert only. A row handed over stays handed over."""
		for doctype in AUTHORED_DOCTYPES:
			with self.subTest(doctype=doctype):
				doc = self._insert(doctype, self.author.name)
				doc.set("authors", [{"author": self.colleague.name}])
				doc.save()

				frappe.set_user(self.colleague.name)
				handed_over = frappe.get_doc(doctype, doc.name)
				handed_over.save()
				frappe.set_user("Administrator")

				self.assertEqual(authors_of(doctype, doc.name), [self.colleague.name])

	def test_a_row_from_before_the_field_existed_still_resolves_to_its_owner(self):
		"""The assertion the no-backfill decision rests on.

		Every row already on a live site was inserted with no `authors`, and no
		patch fills them. Deleting the child rows reproduces exactly that state:
		`authors` is empty and `owner` is the only record of who made it, which is
		what the predicate that reads this field has to fall back to. If `owner`
		were ever blank here, a backfill would be the only way to name an author
		and this commit would need one.
		"""
		for doctype in AUTHORED_DOCTYPES:
			with self.subTest(doctype=doctype):
				doc = self._insert(doctype, self.author.name)
				frappe.db.delete("LMS Content Author", {"parent": doc.name, "parenttype": doctype})

				self.assertEqual(authors_of(doctype, doc.name), [])
				self.assertEqual(frappe.db.get_value(doctype, doc.name, "owner"), self.author.name)


class TestImportedContentAuthors(BaseTestUtils):
	"""A course ZIP carries `authors`, and `authors` names people on the source site.

	The export writes each assessment with `as_dict()`, which serialises the child
	rows, and the import rebuilds the document with `doc.update(<that dict>)`. That
	runs before `AuthoredDocument.before_insert` looks at an empty list, so unless
	the import drops the field the seed never fires and the imported row still
	answers to a site it is no longer on.
	"""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.hash = frappe.generate_hash(length=6)
		self.source_author = self._create_user(
			f"ica-s-{self.hash}@example.com", "Sam", "Source", ["Course Creator"]
		)
		self.importer = self._create_user(
			f"ica-i-{self.hash}@example.com", "Iris", "Importer", ["Course Creator"]
		)
		# Deliberately never created: the source-site account a target site has no row for.
		self.absent_author = f"ica-absent-{self.hash}@example.com"

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _exported(self, doctype, author):
		"""The payload a ZIP holds, produced by the export path and put on the wire.

		The source row is deleted afterwards so `build_assessment_doc`'s
		`frappe.db.exists` guard behaves the way it does on a site that has never
		seen this assessment -- which is the only situation an import happens in.
		"""
		frappe.set_user(author)
		doc = frappe.get_doc({"doctype": doctype, **minimal_payload(doctype, self.hash)}).insert()
		frappe.set_user("Administrator")

		wire = json.loads(frappe_json_dumps(frappe.get_doc(doctype, doc.name).as_dict()))
		frappe.delete_doc(doctype, doc.name, force=True, ignore_permissions=True)
		wire.pop("lesson", None)
		wire.pop("course", None)
		return wire

	def _import(self, wire):
		frappe.set_user(self.importer.name)
		try:
			build_assessment_doc(wire)
		finally:
			frappe.set_user("Administrator")
		return frappe.db.get_value(wire["doctype"], {"title": wire["title"]}, "name")

	def test_the_export_carries_the_authors_it_is_this_suites_job_to_strip(self):
		"""The control. Every refusal below is vacuous if the field never travelled."""
		for doctype in ("LMS Quiz", "LMS Assignment", "LMS Programming Exercise", "LMS Question"):
			with self.subTest(doctype=doctype):
				wire = self._exported(doctype, self.source_author.name)
				self.assertEqual([row["author"] for row in wire["authors"]], [self.source_author.name])

	def test_an_imported_assessment_answers_to_whoever_imported_it(self):
		"""A same-email account on the target site is a different person.

		Asserted on the field rather than on a permission, because no permission
		reads it yet -- that lands in the commit after this one. Once it does, this
		row is what decides whether the importer may edit what they just imported,
		and whether the stranger who shares the source author's email may.
		"""
		for doctype in ("LMS Quiz", "LMS Assignment", "LMS Programming Exercise"):
			with self.subTest(doctype=doctype):
				name = self._import(self._exported(doctype, self.source_author.name))

				self.assertEqual(authors_of(doctype, name), [self.importer.name])
				self.assertEqual(frappe.db.get_value(doctype, name, "owner"), self.importer.name)

	def test_an_import_whose_author_has_no_account_here_still_lands(self):
		"""The severe half: a Link that cannot resolve takes the whole import down.

		`author` is a Link to User, so an author this site has never heard of raises
		LinkValidationError out of `insert()` and no part of the course arrives.
		"""
		for doctype in ("LMS Quiz", "LMS Assignment", "LMS Programming Exercise"):
			with self.subTest(doctype=doctype):
				wire = self._exported(doctype, self.source_author.name)
				wire["authors"] = [{"doctype": "LMS Content Author", "author": self.absent_author}]

				name = self._import(wire)
				self.assertTrue(name, f"{doctype} did not import")
				self.assertEqual(authors_of(doctype, name), [self.importer.name])

	def test_an_imported_question_answers_to_whoever_imported_it(self):
		"""LMS Question arrives through its own function, so it needs its own strip."""
		wire = self._exported("LMS Question", self.source_author.name)
		wire["authors"] = [{"doctype": "LMS Content Author", "author": self.absent_author}]

		buffer = io.BytesIO()
		with zipfile.ZipFile(buffer, "w") as archive:
			archive.writestr("assessments/questions/q.json", frappe_json_dumps(wire))

		frappe.set_user(self.importer.name)
		try:
			with zipfile.ZipFile(buffer) as archive:
				create_supporting_docs(archive)
		finally:
			frappe.set_user("Administrator")

		name = frappe.db.get_value("LMS Question", {"question": wire["question"]}, "name")
		self.assertTrue(name, "LMS Question did not import")
		self.assertEqual(authors_of("LMS Question", name), [self.importer.name])
