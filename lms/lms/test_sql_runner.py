from decimal import Decimal
from unittest.mock import patch

import frappe
import MySQLdb

from lms.lms.api import (
	create_programming_exercise_submission,
	get_sql_tables,
	preview_sql,
	run_sql_test_case,
)
from lms.lms.sql_runner import (
	SandboxUnavailable,
	_admin_connection,
	describe_tables,
	format_result,
	run_sql,
)
from lms.lms.test_helpers import BaseTestUtils

SETUP = """
CREATE TABLE students (id INT PRIMARY KEY, name VARCHAR(50), score DECIMAL(4, 2));
INSERT INTO students VALUES (1, 'An', 9.5), (2, 'Binh', 7.25), (3, 'Chi', 8.75);
"""


class TestFormatResult(BaseTestUtils):
	def test_header_then_tab_separated_rows(self):
		output = format_result(["id", "name"], [(1, "An"), (2, None)], ordered=True)
		self.assertEqual(output, "id\tname\n1\tAn\n2\tNULL")

	def test_rows_are_sorted_unless_order_matters(self):
		rows = [(2, "b"), (1, "a")]
		self.assertEqual(format_result(["id", "x"], rows, ordered=False), "id\tx\n1\ta\n2\tb")
		self.assertEqual(format_result(["id", "x"], rows, ordered=True), "id\tx\n2\tb\n1\ta")

	def test_decimals_and_bytes_print_as_text(self):
		output = format_result(["v", "b"], [(Decimal("8.50"), b"hi")], ordered=True)
		self.assertEqual(output, "v\tb\n8.50\thi")


def sandbox_available() -> bool:
	if not (frappe.conf.get("sql_sandbox_password") or frappe.conf.get("sql_sandbox_root_password")):
		return False
	try:
		run_sql(None, None, "SELECT 1", True)
	except SandboxUnavailable:
		return False
	return True


class TestSQLSandbox(BaseTestUtils):
	"""Runs against the real sandbox configured in site_config; skipped without one."""

	def setUp(self):
		super().setUp()
		if not sandbox_available():
			self.skipTest("SQL sandbox is not configured")

	def test_runs_setup_seed_and_learner_query(self):
		stdout, stderr = run_sql(
			SETUP,
			"INSERT INTO students VALUES (4, 'Dung', 9.0);",
			"SELECT name FROM students WHERE score > 8.6",
			False,
		)
		self.assertEqual(stderr, "")
		self.assertEqual(stdout, "name\nAn\nChi\nDung")

	def test_last_result_set_is_the_output(self):
		stdout, _ = run_sql(
			SETUP,
			None,
			"UPDATE students SET score = 10 WHERE id = 2; SELECT score FROM students WHERE id = 2",
			True,
		)
		self.assertEqual(stdout, "score\n10.00")

	def test_learner_mistake_is_reported_not_raised(self):
		stdout, stderr = run_sql(SETUP, None, "SELEC name FROM students", False)
		self.assertEqual(stdout, "")
		self.assertIn("ERROR 1064", stderr)

	def test_code_without_a_result_set_is_rejected(self):
		_, stderr = run_sql(SETUP, None, "DELETE FROM students", False)
		self.assertIn("SELECT", stderr)

	def test_learner_cannot_reach_other_databases(self):
		_, stderr = run_sql(SETUP, None, "SELECT user FROM mysql.user", False)
		self.assertIn("ERROR", stderr)
		stdout, _ = run_sql(
			SETUP,
			None,
			"SELECT COUNT(*) AS n FROM information_schema.schemata WHERE schema_name = 'mysql'",
			False,
		)
		self.assertEqual(stdout, "n\n0")

	def test_long_query_is_stopped(self):
		stdout, stderr = run_sql(SETUP, None, "SELECT SLEEP(30)", False)
		# SLEEP cut short by max_statement_time either errors or returns 1.
		self.assertTrue(stderr or stdout == "SLEEP(30)\n1")

	def test_recreating_a_table_explains_the_tables_exist(self):
		_, stderr = run_sql(SETUP, None, "CREATE TABLE students (id INT)", False)
		self.assertIn("ERROR 1050", stderr)
		self.assertIn("already created for you", stderr)

	def test_describe_tables_lists_each_table_with_its_rows(self):
		tables = describe_tables(SETUP)
		self.assertEqual(len(tables), 1)
		self.assertEqual(tables[0]["name"], "students")
		self.assertEqual(tables[0]["columns"], ["id", "name", "score"])
		self.assertEqual(tables[0]["rows"][0], ["1", "An", "9.50"])
		self.assertEqual(tables[0]["total"], 3)

	def test_scratch_database_and_user_are_dropped(self):
		run_sql(SETUP, None, "SELECT 1", False)
		run_sql(SETUP, None, "SELEC 1", False)
		admin = _admin_connection()
		try:
			with admin.cursor() as cursor:
				cursor.execute(
					"SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name LIKE 'sqlx\\_%%'"
				)
				self.assertEqual(cursor.fetchone()[0], 0)
				# A least-privilege sandbox user cannot read mysql.user; root can.
				try:
					cursor.execute("SELECT COUNT(*) FROM mysql.user WHERE user LIKE 'sqlx\\_%%'")
				except MySQLdb.Error:
					return
				self.assertEqual(cursor.fetchone()[0], 0)
		finally:
			admin.close()


class TestSQLExerciseAPI(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.exercise = frappe.get_doc(
			{
				"doctype": "LMS Programming Exercise",
				"title": frappe.generate_hash(length=8),
				"language": "SQL",
				"problem_statement": "<p>Names of students scoring above 8.6.</p>",
				"sql_setup": SETUP,
				"test_cases": [
					{"input": "", "expected_output": "name\nAn\nChi", "hidden": 0},
					{
						"input": "INSERT INTO students VALUES (4, 'Dung', 9.0);",
						"expected_output": "name\nAn\nChi\nDung",
						"hidden": 1,
					},
				],
			}
		).insert()

	def test_sql_exercise_requires_setup(self):
		doc = frappe.get_doc(
			{
				"doctype": "LMS Programming Exercise",
				"title": frappe.generate_hash(length=8),
				"language": "SQL",
				"problem_statement": "<p>x</p>",
				"test_cases": [{"input": "", "expected_output": "x"}],
			}
		)
		self.assertRaises(frappe.exceptions.MandatoryError, doc.insert)

	def test_run_uses_the_stored_case_input(self):
		with patch("lms.lms.sql_runner.run_sql", return_value=("out", "")) as run:
			result = run_sql_test_case(self.exercise.name, "SELECT 1", 2)
		self.assertEqual(result, {"stdout": "out", "stderr": ""})
		setup, seed, code, ordered = run.call_args.args
		self.assertEqual(setup, SETUP)
		self.assertEqual(seed, "INSERT INTO students VALUES (4, 'Dung', 9.0);")
		self.assertEqual(code, "SELECT 1")

	def test_tables_come_from_the_setup_only(self):
		with patch("lms.lms.sql_runner.describe_tables", return_value=[]) as describe:
			get_sql_tables(self.exercise.name)
		describe.assert_called_once_with(SETUP)

	def test_an_errored_case_scores_with_no_output(self):
		with patch("lms.lms.sql_runner.run_sql", return_value=("", "ERROR 1064: bad")):
			name = create_programming_exercise_submission(self.exercise.name, "new", "SELEC")
		submission = frappe.get_doc("LMS Programming Exercise Submission", name)
		self.assertEqual([row.output for row in submission.test_cases], ["", ""])

	def test_an_updated_submission_keeps_its_rows_in_case_order(self):
		with patch("lms.lms.sql_runner.run_sql", return_value=("name", "")):
			name = create_programming_exercise_submission(self.exercise.name, "new", "SELECT 1")
			create_programming_exercise_submission(self.exercise.name, name, "SELECT 2")
		rows = frappe.get_all(
			"LMS Test Case Submission", filters={"parent": name}, fields=["idx", "input"], order_by="idx"
		)
		self.assertEqual([row.idx for row in rows], [1, 2])
		self.assertEqual(rows[0].input, "")

	def test_run_rejects_non_sql_exercise(self):
		self.exercise.db_set("language", "Python")
		self.assertRaises(frappe.ValidationError, run_sql_test_case, self.exercise.name, "SELECT 1", 1)

	def test_preview_is_for_authors_only(self):
		frappe.set_user("Guest")
		try:
			self.assertRaises(frappe.PermissionError, preview_sql, SETUP, "SELECT 1")
		finally:
			frappe.set_user("Administrator")

	def test_submission_is_scored_by_the_sandbox(self):
		outputs = iter([("name\nAn\nChi", ""), ("name\nAn\nChi", "")])
		with patch("lms.lms.sql_runner.run_sql", side_effect=lambda *args: next(outputs)):
			name = create_programming_exercise_submission(
				self.exercise.name, "new", "SELECT name FROM students WHERE score > 8.6"
			)
		submission = frappe.get_doc("LMS Programming Exercise Submission", name)
		self.assertEqual([row.status for row in submission.test_cases], ["Passed", "Failed"])
		self.assertEqual(submission.status, "Failed")
