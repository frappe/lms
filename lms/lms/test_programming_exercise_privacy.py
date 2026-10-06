import json
from unittest.mock import patch

import frappe
import requests
from frappe.client import get as client_get
from frappe.client import get_list as client_get_list

from lms.lms.api import (
	_redact_expected,
	create_programming_exercise_submission,
	evaluate_programming_exercise,
	get_programming_exercise,
)
from lms.lms.code_runner import BOILERPLATE, RunnerUnavailable, read_stdout
from lms.lms.course_import_export import build_assessment_doc
from lms.lms.test_helpers import BaseTestUtils
from lms.patches.v2_0 import unhide_existing_test_cases as unhide_patch


# Guards hidden-by-default cases, starter code, import visibility, the backfill.
# Came with this branch's starter code and hidden test cases for exercises.
# Added on feat/assessment-visual-redesign to pin the schema and its patch.
class TestProgrammingExerciseSchema(BaseTestUtils):
	def test_a_new_test_case_is_hidden_by_default(self):
		exercise = frappe.get_doc(
			{
				"doctype": "LMS Programming Exercise",
				"title": frappe.generate_hash(length=8),
				"language": "Python",
				"problem_statement": "<p>Add two integers.</p>",
				"test_cases": [{"input": "2 3", "expected_output": "5"}],
			}
		).insert()

		self.assertEqual(exercise.test_cases[0].hidden, 1)

	def test_course_import_keeps_each_case_visibility(self):
		# Guards import dropping `hidden`, so every imported case took the default 1.
		# Import came with #2286; the flag with this branch's hidden test cases.
		# Added on feat/assessment-visual-redesign; old zips carry no flag, so visible.
		title = frappe.generate_hash(length=8)
		build_assessment_doc(
			{
				"doctype": "LMS Programming Exercise",
				"name": title,
				"title": title,
				"language": "Python",
				"problem_statement": "<p>Add two integers.</p>",
				"test_cases": [
					{"input": "2 3", "expected_output": "5", "hidden": 1},
					{"input": "4 5", "expected_output": "9", "hidden": 0},
					{"input": "6 7", "expected_output": "13"},
				],
			}
		)

		hidden = frappe.get_all(
			"LMS Test Case", filters={"parent": title}, fields=["hidden"], order_by="idx asc", pluck="hidden"
		)
		self.assertEqual(hidden, [1, 0, 0])

	def test_starter_code_round_trips(self):
		exercise = frappe.get_doc(
			{
				"doctype": "LMS Programming Exercise",
				"title": frappe.generate_hash(length=8),
				"language": "Python",
				"problem_statement": "<p>Add two integers.</p>",
				"starter_code": "def add(a, b):\n    pass\n",
				"test_cases": [{"input": "2 3", "expected_output": "5"}],
			}
		).insert()

		self.assertEqual(
			frappe.db.get_value("LMS Programming Exercise", exercise.name, "starter_code"),
			"def add(a, b):\n    pass\n",
		)

	def test_backfill_patch_unhides_existing_rows_and_is_idempotent(self):
		exercise = frappe.get_doc(
			{
				"doctype": "LMS Programming Exercise",
				"title": frappe.generate_hash(length=8),
				"language": "Python",
				"problem_statement": "<p>Add two integers.</p>",
				"test_cases": [
					{"input": "2 3", "expected_output": "5"},
					{"input": "4 5", "expected_output": "9"},
					{"input": "6 7", "expected_output": "13"},
				],
			}
		).insert()

		test_case_names = [test_case.name for test_case in exercise.test_cases]
		for name in test_case_names:
			self.assertEqual(frappe.db.get_value("LMS Test Case", name, "hidden"), 1)

		# The patch runs inside the migrate's transaction and must never commit part
		# of it; the mock also keeps any commit from escaping the runner rollback.
		with patch.object(frappe.db, "commit") as commit:
			unhide_patch.execute()

			for name in test_case_names:
				self.assertEqual(frappe.db.get_value("LMS Test Case", name, "hidden"), 0)

			unhide_patch.execute()

			for name in test_case_names:
				self.assertEqual(frappe.db.get_value("LMS Test Case", name, "hidden"), 0)

		commit.assert_not_called()


# Guards a learner receiving a hidden case's expected output from the endpoint.
# Came with this branch's hidden test cases for programming exercises.
# Added on feat/assessment-visual-redesign to pin the withholding by role.
class TestProgrammingExerciseRead(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.exercise = frappe.get_doc(
			{
				"doctype": "LMS Programming Exercise",
				"title": frappe.generate_hash(length=8),
				"language": "Python",
				"problem_statement": "<p>Add two integers.</p>",
				"test_cases": [
					{"input": "2 3", "expected_output": "5", "hidden": 0},
					{"input": "0 0", "expected_output": "0", "hidden": 1},
				],
			}
		).insert()
		# Unplaced, this exercise is unreachable under the assessment access
		# predicate: a learner needs a course that actually places it.
		instructor = self._create_user(
			f"pe-read-instructor-{frappe.generate_hash(length=8)}@example.com",
			"PE",
			"Instructor",
			roles=["Course Creator"],
		)
		self.course = self._create_course(
			title=f"PE Read Course {frappe.generate_hash(length=8)}", instructor=instructor.name
		)
		self._place_in_lesson(self.course.name, "LMS Programming Exercise", self.exercise.name)

	def test_a_learner_never_receives_a_hidden_expected_output(self):
		email = f"pe-student-{frappe.generate_hash(length=8)}@example.com"
		student = self._create_user(email, "PE", "Student", roles=["LMS Student"], user_type="Website User")
		roles = frappe.get_roles(student.name)
		self.assertIn("LMS Student", roles)
		self.assertFalse({"Moderator", "Course Creator", "Batch Evaluator"} & set(roles))
		self._create_enrollment(student.name, self.course.name)

		frappe.set_user(student.name)
		try:
			result = get_programming_exercise(self.exercise.name)
		finally:
			frappe.set_user("Administrator")

		visible, hidden = result["test_cases"]
		self.assertEqual(visible["expected_output"], "5")
		self.assertIsNone(hidden["expected_output"])
		self.assertEqual(hidden["input"], "0 0")

	def test_an_author_receives_every_expected_output(self):
		result = get_programming_exercise(self.exercise.name)

		self.assertEqual(result["test_cases"][1]["expected_output"], "0")

	def test_a_non_string_exercise_is_rejected(self):
		# The type annotation rejects this before the body's isinstance check.
		self.assertRaises(
			frappe.exceptions.FrappeTypeError,
			get_programming_exercise,
			["not", "a", "string"],
		)


# Guards server-side scoring and its hidden-answer withholding for learners.
# Came with this branch's server-side scoring of exercise runs.
# Added on feat/assessment-visual-redesign to pin scoring and input checks.
class TestProgrammingExerciseEvaluate(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.exercise = frappe.get_doc(
			{
				"doctype": "LMS Programming Exercise",
				"title": frappe.generate_hash(length=8),
				"language": "Python",
				"problem_statement": "<p>Add two integers.</p>",
				"test_cases": [
					{"input": "2 3", "expected_output": "5", "hidden": 0},
					{"input": "0 0", "expected_output": "0", "hidden": 1},
				],
			}
		).insert()
		# Unplaced, this exercise is unreachable under the assessment access
		# predicate: a learner needs a course that actually places it.
		instructor = self._create_user(
			f"pe-eval-instructor-{frappe.generate_hash(length=8)}@example.com",
			"PE",
			"Instructor",
			roles=["Course Creator"],
		)
		self.course = self._create_course(
			title=f"PE Eval Course {frappe.generate_hash(length=8)}", instructor=instructor.name
		)
		self._place_in_lesson(self.course.name, "LMS Programming Exercise", self.exercise.name)

	def test_it_scores_a_mix_of_hidden_and_visible_cases(self):
		result = evaluate_programming_exercise(self.exercise.name, ["5", "0.0"])

		self.assertEqual(result[0]["status"], "Passed")
		self.assertEqual(result[1]["status"], "Failed")

	def test_it_compares_on_trimmed_output(self):
		result = evaluate_programming_exercise(self.exercise.name, ["  5\n", " 0 "])

		self.assertEqual([case["status"] for case in result], ["Passed", "Passed"])

	def test_a_learner_result_still_withholds_the_hidden_answer(self):
		email = f"pe-eval-{frappe.generate_hash(length=8)}@example.com"
		student = self._create_user(email, "PE", "Eval", roles=["LMS Student"], user_type="Website User")
		roles = frappe.get_roles(student.name)
		self.assertIn("LMS Student", roles)
		self.assertFalse({"Moderator", "Course Creator", "Batch Evaluator"} & set(roles))
		self._create_enrollment(student.name, self.course.name)

		frappe.set_user(student.name)
		try:
			result = evaluate_programming_exercise(self.exercise.name, ["5", "9"])
		finally:
			frappe.set_user("Administrator")

		self.assertEqual(result[1]["status"], "Failed")
		self.assertIsNone(result[1]["expected_output"])

	def test_non_list_outputs_are_rejected(self):
		# The `list` annotation rejects this before the body's isinstance check.
		self.assertRaises(
			frappe.exceptions.FrappeTypeError,
			evaluate_programming_exercise,
			self.exercise.name,
			"5",
		)

	def test_a_wrong_length_outputs_list_is_rejected(self):
		# A genuine list is correctly typed, so this reaches the body and
		# hits frappe.throw rather than the annotation gate.
		self.assertRaises(
			frappe.ValidationError,
			evaluate_programming_exercise,
			self.exercise.name,
			["5"],
		)


# Guards /api/resource handing learners every answer, bypassing the endpoint.
# Came with this branch's hidden cases; fixed by expected_output at permlevel 1.
# Added on feat/assessment-visual-redesign to pin the field-level withholding.
class TestProgrammingExerciseFieldPermissions(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.exercise = frappe.get_doc(
			{
				"doctype": "LMS Programming Exercise",
				"title": frappe.generate_hash(length=8),
				"language": "Python",
				"problem_statement": "<p>Add two integers.</p>",
				"test_cases": [
					{"input": "2 3", "expected_output": "5", "hidden": 0},
					{"input": "0 0", "expected_output": "0", "hidden": 1},
				],
			}
		).insert()
		# The assessment access predicate only reaches an exercise through a course
		# or batch: an unplaced one is unreadable by design, so a field-masking test
		# needs a legitimately-scoped reader, not just any LMS Student.
		instructor = self._create_user(
			f"pe-perm-instructor-{frappe.generate_hash(length=8)}@example.com",
			"PE",
			"Instructor",
			roles=["Course Creator"],
		)
		self.course = self._create_course(
			title=f"PE Perm Course {frappe.generate_hash(length=8)}", instructor=instructor.name
		)
		self._place_in_lesson(self.course.name, "LMS Programming Exercise", self.exercise.name)

	def _student(self, tag):
		email = f"pe-{tag}-{frappe.generate_hash(length=8)}@example.com"
		student = self._create_user(email, "PE", "Perm", roles=["LMS Student"], user_type="Website User")
		roles = frappe.get_roles(student.name)
		self.assertIn("LMS Student", roles)
		self.assertFalse({"Moderator", "Course Creator", "Batch Evaluator"} & set(roles))
		self._create_enrollment(student.name, self.course.name)
		return student.name

	def test_the_field_carries_permlevel_1_in_the_database(self):
		# The JSON is inert until it reaches tabDocField, and every assertion
		# below would pass vacuously against a stale meta.
		self.assertEqual(
			frappe.db.get_value(
				"DocField", {"parent": "LMS Test Case", "fieldname": "expected_output"}, "permlevel"
			),
			1,
		)
		granted = {
			perm.role
			for perm in frappe.get_meta("LMS Programming Exercise").permissions
			if perm.permlevel == 1 and perm.read
		}
		self.assertEqual(granted, {"System Manager", "Moderator", "Course Creator", "Batch Evaluator"})

	def test_the_generic_read_path_strips_every_expected_output(self):
		student = self._student("client")

		frappe.set_user(student)
		try:
			doc = client_get("LMS Programming Exercise", self.exercise.name)
		finally:
			frappe.set_user("Administrator")

		# Visible as well as hidden: the field is withheld wholesale here, and
		# the endpoint is the only place a visible answer is handed back.
		for case in doc["test_cases"]:
			self.assertNotIn("expected_output", case)
		self.assertEqual([case["input"] for case in doc["test_cases"]], ["2 3", "0 0"])

	def test_the_child_list_path_strips_it_too(self):
		student = self._student("list")

		frappe.set_user(student)
		try:
			rows = client_get_list(
				"LMS Test Case",
				fields=["input", "expected_output"],
				filters={"parent": self.exercise.name},
				parent="LMS Programming Exercise",
			)
		finally:
			frappe.set_user("Administrator")

		self.assertTrue(rows)
		for row in rows:
			self.assertNotIn("expected_output", row)

	def test_an_author_still_reads_and_writes_the_field(self):
		email = f"pe-author-{frappe.generate_hash(length=8)}@example.com"
		author = self._create_user(email, "PE", "Author", roles=["Moderator"], user_type="System User")
		self.assertIn("Moderator", frappe.get_roles(author.name))

		frappe.set_user(author.name)
		try:
			doc = client_get("LMS Programming Exercise", self.exercise.name)
			self.assertEqual([case["expected_output"] for case in doc["test_cases"]], ["5", "0"])

			# permlevel-1 write, not only read: without it frappe resets the
			# field to its stored value on save and authoring breaks silently.
			editable = frappe.get_doc("LMS Programming Exercise", self.exercise.name)
			editable.test_cases[0].expected_output = "55"
			editable.save()
		finally:
			frappe.set_user("Administrator")

		self.assertEqual(
			frappe.db.get_value("LMS Test Case", self.exercise.test_cases[0].name, "expected_output"),
			"55",
		)


# Guards the withholding rule both endpoints share.
# Came with this branch's move of the rule into one helper.
# Added on feat/assessment-visual-redesign to pin it without a request.
class TestRedactExpected(BaseTestUtils):
	def _case(self, hidden):
		return frappe._dict({"hidden": hidden, "expected_output": "5"})

	def test_a_hidden_case_is_withheld_from_a_learner(self):
		self.assertIsNone(_redact_expected(self._case(1), author=False))

	def test_a_visible_case_is_not(self):
		self.assertEqual(_redact_expected(self._case(0), author=False), "5")

	def test_an_author_sees_a_hidden_case(self):
		self.assertEqual(_redact_expected(self._case(1), author=True), "5")


# Guards #2856: learners got 403 on save, empty output failed, and the browser's
# status was stored as the result. Came with 7e683f8b4's only_for and the
# browser-scored save. Added on fix-1 to pin the server running the save itself.
class TestProgrammingExerciseSubmissionSave(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.exercise = frappe.get_doc(
			{
				"doctype": "LMS Programming Exercise",
				"title": frappe.generate_hash(length=8),
				"language": "Python",
				"problem_statement": "<p>Add two integers.</p>",
				"test_cases": [
					{"input": "2 3", "expected_output": "5", "hidden": 0},
					{"input": "0 0", "expected_output": "0", "hidden": 1},
				],
			}
		).insert()
		instructor = self._create_user(
			f"pe-save-instructor-{frappe.generate_hash(length=8)}@example.com",
			"PE",
			"Instructor",
			roles=["Course Creator"],
		)
		course = self._create_course(
			title=f"PE Save Course {frappe.generate_hash(length=8)}", instructor=instructor.name
		)
		self._place_in_lesson(course.name, "LMS Programming Exercise", self.exercise.name)
		self.student = self._create_user(
			f"pe-save-{frappe.generate_hash(length=8)}@example.com",
			"PE",
			"Save",
			roles=["LMS Student"],
			user_type="Website User",
		)
		self._create_enrollment(self.student.name, course.name)

	def _save_as_student(self, outputs, submission="new", code="print(input())"):
		"""Save as the learner, with the code runner answering `outputs`, one per case."""
		frappe.set_user(self.student.name)
		try:
			with patch("lms.lms.api.run_test_cases", return_value=outputs) as runner:
				name = create_programming_exercise_submission(self.exercise.name, submission, code)
		finally:
			frappe.set_user("Administrator")
		self.runner_calls = runner.call_args_list
		return name

	def _stored(self, name):
		return frappe.get_doc("LMS Programming Exercise Submission", name)

	def test_a_learner_can_save_a_submission(self):
		name = self._save_as_student(["5", "0"])

		self.assertEqual(self._stored(name).status, "Passed")

	def test_the_verdict_comes_from_the_code_the_server_ran(self):
		name = self._save_as_student(["1", "1"], code="print(1)")

		stored = self._stored(name)
		self.assertEqual(stored.status, "Failed")
		self.assertEqual([row.status for row in stored.test_cases], ["Failed", "Failed"])
		self.assertEqual(stored.test_cases[0].expected_output, "5")
		_, code, _ = self.runner_calls[0].args
		self.assertEqual(code, "print(1)")

	def test_the_code_runs_whole_but_is_stored_without_the_boilerplate(self):
		code = BOILERPLATE["python"] + "print(inputs[0])\n"
		name = self._save_as_student(["5", "0"], code=code)

		_, ran, _ = self.runner_calls[0].args
		self.assertEqual(ran, code)
		self.assertEqual(self._stored(name).code, "print(inputs[0])\n")
		self.assertFalse(self._stored(name).full_code)

	def test_code_with_an_edited_boilerplate_is_stored_whole(self):
		code = "import sys\nprint(sys.stdin.read())"
		name = self._save_as_student(["5", "0"], code=code)

		self.assertEqual(self._stored(name).code, code)
		# Flagged, or the page would add the boilerplate back and run it twice.
		self.assertTrue(self._stored(name).full_code)

	def test_an_update_resets_the_full_code_flag(self):
		name = self._save_as_student(["5", "0"], code="import sys\nprint(sys.stdin.read())")

		self._save_as_student(["5", "0"], submission=name, code=BOILERPLATE["python"] + "print(1)\n")

		self.assertFalse(self._stored(name).full_code)

	def test_code_from_starter_code_is_stored_whole(self):
		frappe.db.set_value("LMS Programming Exercise", self.exercise.name, "starter_code", "pass\n")
		code = BOILERPLATE["python"] + "print(inputs[0])\n"
		name = self._save_as_student(["5", "0"], code=code)

		self.assertEqual(self._stored(name).code, code)

	def test_a_hidden_answer_is_not_stored_in_the_learner_row(self):
		name = self._save_as_student(["5", "0"])

		self.assertIsNone(self._stored(name).test_cases[1].expected_output)

	def test_a_program_that_prints_nothing_can_be_saved(self):
		name = self._save_as_student(["", ""])

		self.assertEqual(self._stored(name).status, "Failed")

	def test_an_output_longer_than_a_data_field_can_be_saved(self):
		long_output = "y" * 500
		name = self._save_as_student([long_output, "0"])

		self.assertEqual(self._stored(name).test_cases[0].output, long_output)

	def test_an_update_is_run_again(self):
		name = self._save_as_student(["5", "0"])

		returned = self._save_as_student(["1", "0"], submission=name)

		self.assertEqual(self._stored(name).status, "Failed")
		# The page saves its next run under whatever name this returns.
		self.assertEqual(returned, name)

	def test_an_unreachable_runner_saves_nothing(self):
		before = frappe.db.count("LMS Programming Exercise Submission", {"member": self.student.name})
		frappe.set_user(self.student.name)
		try:
			with patch("lms.lms.code_runner.requests.post", side_effect=requests.ConnectionError):
				self.assertRaises(
					frappe.ValidationError,
					create_programming_exercise_submission,
					self.exercise.name,
					"new",
					"print(input())",
				)
		finally:
			frappe.set_user("Administrator")

		self.assertEqual(
			frappe.db.count("LMS Programming Exercise Submission", {"member": self.student.name}), before
		)


# Guards reading a run back from the code runner's raw /exec response.
# Came with the server running a submission itself. Added on fix-1.
class TestCodeRunnerResponse(BaseTestUtils):
	def _body(self, *messages):
		return "\n".join(json.dumps(message) for message in messages) + "\n"

	def test_it_joins_the_stdout_writes(self):
		body = self._body(
			{"msgtype": "write", "file": "stdout", "data": "Not "},
			{"msgtype": "write", "file": "stdout", "data": "Weird\n"},
			{"msgtype": "exitstatus", "exitstatus": 0},
		)

		self.assertEqual(read_stdout(body), "Not Weird\n")

	def test_it_leaves_stderr_out(self):
		body = self._body(
			{"msgtype": "write", "file": "stderr", "data": "Traceback"},
			{"msgtype": "exitstatus", "exitstatus": 1},
		)

		self.assertEqual(read_stdout(body), "")

	def test_a_run_cut_off_before_its_exit_status_is_not_a_result(self):
		body = self._body({"msgtype": "write", "file": "stdout", "data": "5"})

		self.assertRaises(RunnerUnavailable, read_stdout, body)
