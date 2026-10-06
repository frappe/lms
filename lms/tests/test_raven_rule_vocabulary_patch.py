import json

import frappe
from frappe.tests import UnitTestCase
from frappe.tests.utils import FrappeTestCase

from lms.patches.v2_0.migrate_raven_rule_vocabulary import execute, migrate_tree
from lms.raven_provider import ProviderDataError, default_evaluator


def _leaf(rule_type, config, provider="LMS"):
	"""One stored condition, in the shape `member_rules_json` holds."""
	return {
		"label": "",
		"provider": provider,
		"rule_type": rule_type,
		"status": "Active",
		"config": config,
	}


def _tree(*leaves):
	return {"conjunctions": ["or"] * max(len(leaves) - 1, 0), "conditions": list(leaves)}


# The four shapes a site could have saved against the pre-Student/Staff vocabulary
# and which say the same thing in the one that replaced it.
CONVERTIBLE = [
	("All Enrolled Students", {"payment_filter": "Paid"}),
	("Students of Courses", {"courses": ["Course A"], "payment_filter": "Any"}),
	("Students of Batches", {"batches": ["Batch A"], "payment_filter": "Free"}),
	("Staff", {"staff_role": "Instructor", "staff_scope_courses": ["Course A"]}),
]


class TestRavenRuleVocabularyMigration(UnitTestCase):
	"""What the patch rewrites, and what it deliberately leaves where it is.

	Schema-free: the conversion is a tree rewrite, and the doctype it reads on a
	real site belongs to raven_integration, which is not installed in CI.
	"""

	def _migrated(self, rule_type, config):
		leaf = _leaf(rule_type, config)
		self.assertTrue(migrate_tree(_tree(leaf)))
		return leaf

	def test_all_enrolled_students_becomes_every_enrollment(self):
		leaf = self._migrated("All Enrolled Students", {"payment_filter": "Paid"})
		self.assertEqual(leaf["rule_type"], "Student")
		self.assertEqual(
			leaf["config"],
			{"payment_filter": "Paid", "student_scope": "Enrolled", "enrolled_in": "Any"},
		)

	def test_students_of_courses_keeps_its_courses_and_payment_filter(self):
		leaf = self._migrated("Students of Courses", {"courses": ["Course A"], "payment_filter": "Free"})
		self.assertEqual(leaf["rule_type"], "Student")
		self.assertEqual(
			leaf["config"],
			{
				"courses": ["Course A"],
				"payment_filter": "Free",
				"student_scope": "Enrolled",
				"enrolled_in": "Courses",
			},
		)

	def test_students_of_batches_keeps_its_batches_and_payment_filter(self):
		leaf = self._migrated("Students of Batches", {"batches": ["Batch A"], "payment_filter": "Paid"})
		self.assertEqual(leaf["rule_type"], "Student")
		self.assertEqual(
			leaf["config"],
			{
				"batches": ["Batch A"],
				"payment_filter": "Paid",
				"student_scope": "Enrolled",
				"enrolled_in": "Batches",
			},
		)

	def test_an_instructor_rule_carries_its_scope_over(self):
		# The old rule read "no scope at all" as every instructor on the site, which
		# is what `assigned_scope: Any` says now. Reading an emptied scope as Any
		# would widen the rule instead, so the choice is made from what is stored.
		cases = [
			("unscoped", {}, "Any"),
			("courses", {"staff_scope_courses": ["Course A"]}, "Courses"),
			("batches", {"staff_scope_batches": ["Batch A"]}, "Batches"),
			(
				"both",
				{"staff_scope_courses": ["Course A"], "staff_scope_batches": ["Batch A"]},
				"Both",
			),
		]
		for case, scope, expected in cases:
			with self.subTest(case=case):
				leaf = self._migrated("Staff", {"staff_role": "Instructor", **scope})
				self.assertEqual(leaf["rule_type"], "Staff")
				self.assertEqual(
					leaf["config"],
					{
						**scope,
						"staff_kind": "Assigned on",
						"assigned_as": "Instructor",
						"assigned_scope": expected,
					},
				)

	def test_the_staff_roles_with_no_equivalent_are_left_unevaluable(self):
		"""The ones that must keep raising rather than be guessed at.

		"Evaluator" used to mean every Course Evaluator record; the nearest thing
		now is whoever a course or a batch names in its own evaluator field, a
		population that only partly overlaps. "Mentor" has no successor at all, and
		"Any" was the union of all three. Membership sync is authoritative, so a
		conversion that narrows any of them would evict real people from a channel
		with nothing said. ProviderDataError keeps the channel as it is and names
		what to re-create.
		"""
		for gone in ("Evaluator", "Mentor", "Any"):
			with self.subTest(staff_role=gone):
				leaf = _leaf("Staff", {"staff_role": gone})
				self.assertFalse(migrate_tree(_tree(leaf)))
				self.assertEqual(leaf["config"], {"staff_role": gone})

	def test_another_providers_condition_is_not_ours_to_rewrite(self):
		leaf = _leaf("Students of Courses", {"courses": ["Course A"]}, provider="OTHER")
		self.assertFalse(migrate_tree(_tree(leaf)))
		self.assertEqual(leaf["rule_type"], "Students of Courses")

	def test_a_config_that_will_not_parse_is_left_alone(self):
		"""The dangerous direction. A "Students of Courses" whose course list cannot
		be read would convert into a Student condition scoped to nothing, and a
		scoped condition naming nothing matches nobody - which sync applies by
		emptying the channel. Unevaluable is the safe answer for unreadable data."""
		leaf = _leaf("Students of Courses", "{not json")
		self.assertFalse(migrate_tree(_tree(leaf)))
		self.assertEqual(leaf["rule_type"], "Students of Courses")

	def test_a_scope_that_names_nothing_is_left_alone(self):
		"""The same direction as an unreadable config, reached from readable data.

		The old rule types carried the scope in their own field, and a stored one
		can be empty - a list that was emptied, a JSON "[]", or a key never written
		at all. Converted, it becomes a Student condition scoped to nothing, which
		the provider evaluates to the empty set; sync is authoritative, so the next
		sweep applies that by emptying the channel. Unconverted it keeps raising,
		and the channel keeps its members.
		"""
		empty = ({}, {"courses": [], "batches": []}, {"courses": "[]", "batches": "[]"})
		for rule_type in ("Students of Courses", "Students of Batches"):
			for scope in empty:
				with self.subTest(rule_type=rule_type, scope=scope):
					leaf = _leaf(rule_type, {"payment_filter": "Paid", **scope})
					self.assertFalse(migrate_tree(_tree(leaf)))
					self.assertEqual(leaf["rule_type"], rule_type)
					self.assertNotIn("student_scope", leaf["config"])

		# The control, on the same rule types: a scope that names something still
		# converts, so the guard reads the scope rather than refusing the type.
		named = self._migrated("Students of Courses", {"courses": ["Course A"]})
		self.assertEqual(named["rule_type"], "Student")
		self.assertEqual(named["config"]["enrolled_in"], "Courses")

	def test_all_enrolled_students_needs_no_scope_to_convert(self):
		# It carried no scope field to begin with, and converts to the unscoped
		# `enrolled_in: Any`, so the empty-scope guard must not catch it.
		leaf = self._migrated("All Enrolled Students", {})
		self.assertEqual(leaf["config"]["enrolled_in"], "Any")

	def test_a_config_stored_as_json_text_is_read_and_converted(self):
		leaf = _leaf("Students of Courses", '{"courses": ["Course A"]}')
		self.assertTrue(migrate_tree(_tree(leaf)))
		self.assertEqual(leaf["config"]["courses"], ["Course A"])
		self.assertEqual(leaf["config"]["enrolled_in"], "Courses")

	def test_every_branch_of_a_nested_tree_is_walked(self):
		deep = _leaf("Students of Batches", {"batches": ["Batch A"]})
		tree = _tree(_leaf("Student", {"student_scope": "All"}), _tree(_tree(deep)))
		self.assertTrue(migrate_tree(tree))
		self.assertEqual(deep["rule_type"], "Student")

	def test_a_sibling_after_a_converted_one_is_still_reached(self):
		first = _leaf("Students of Courses", {"courses": ["Course A"]})
		second = _leaf("Students of Batches", {"batches": ["Batch A"]})
		self.assertTrue(migrate_tree(_tree(first, second)))
		self.assertEqual(second["rule_type"], "Student")

	def test_running_it_again_changes_nothing(self):
		for rule_type, config in CONVERTIBLE:
			with self.subTest(rule_type=rule_type, config=config):
				tree = _tree(_leaf(rule_type, config))
				self.assertTrue(migrate_tree(tree))
				once = frappe.as_json(tree)
				self.assertFalse(migrate_tree(tree))
				self.assertEqual(frappe.as_json(tree), once)


class TestConvertedConditionsEvaluate(FrappeTestCase):
	"""The regression itself: a stored condition the provider refuses to evaluate.

	Every one of these was savable on LMS v2.61-v2.62. On the current vocabulary
	each raises ProviderDataError, which `resync_all` rolls back and logs, so the
	channel holding it stops syncing until someone re-creates the condition by hand.
	"""

	def test_a_legacy_condition_is_unevaluable_until_the_patch_converts_it(self):
		for rule_type, config in CONVERTIBLE:
			with self.subTest(rule_type=rule_type, config=config):
				with self.assertRaises(ProviderDataError):
					default_evaluator({"rule_type": rule_type, **config})

				leaf = _leaf(rule_type, config)
				self.assertTrue(migrate_tree(_tree(leaf)))
				default_evaluator({"rule_type": leaf["rule_type"], **leaf["config"]})

	def test_an_empty_scope_would_match_nobody_so_it_is_not_converted(self):
		"""Why the empty-scope guard is there, measured on the provider itself.

		The first assertion is the consequence the guard avoids and holds whether or
		not the guard exists: had the rewrite been made, the provider would answer
		the empty set, and an authoritative sync applies that by removing everyone
		the rule put in the channel. The rest is the guard: the condition is left as
		it was, and keeps raising, which is what `resync_all` rolls back and skips.
		"""
		would_have_been = {
			"rule_type": "Student",
			"student_scope": "Enrolled",
			"enrolled_in": "Courses",
			"courses": [],
		}
		self.assertEqual(default_evaluator(would_have_been), set())

		leaf = _leaf("Students of Courses", {"courses": []})
		self.assertFalse(migrate_tree(_tree(leaf)))
		with self.assertRaises(ProviderDataError):
			default_evaluator({"rule_type": leaf["rule_type"], **leaf["config"]})


class TestExecuteAgainstStoredMappings(FrappeTestCase):
	"""The database half: `execute()` reading and writing `member_rules_json`.

	Only runs where the doctype exists. It belongs to raven_integration, an
	optional out-of-tree app, so a site without it has nothing to migrate - which
	is what TestMigrationWithoutRavenIntegration covers instead.
	"""

	def setUp(self):
		if not frappe.db.table_exists("Raven Channel Mapping"):
			self.skipTest("raven_integration is not installed on this site")

	def _mapping_holding(self, tree) -> str:
		"""A channel mapping whose stored tree is `tree`.

		Planted with db.set_value rather than saved: `validate` runs the same
		`validate_rule_config` that refuses the old vocabulary, so a legacy tree is
		not savable through the doc API at all. That is the regression - the data is
		on the site because an older LMS wrote it - so the fixture has to arrive the
		same way.
		"""
		suffix = frappe.generate_hash(length=8)
		workspace = frappe.new_doc("Raven Workspace Mapping")
		workspace.workspace_label = f"Vocabulary Patch {suffix}"
		workspace.workspace_type = "Private"
		workspace.flags.skip_raven_create = True
		workspace.insert()

		channel = frappe.new_doc("Raven Channel Mapping")
		channel.channel_label = f"Vocabulary Patch {suffix}"
		channel.workspace = workspace.name
		channel.channel_type = "Private"
		channel.flags.skip_raven_create = True
		channel.insert()

		frappe.db.set_value(
			"Raven Channel Mapping",
			channel.name,
			"member_rules_json",
			json.dumps(tree),
			update_modified=False,
		)
		return channel.name

	def _stored(self, name):
		return json.loads(frappe.db.get_value("Raven Channel Mapping", name, "member_rules_json"))

	def test_execute_rewrites_a_stored_tree_and_leaves_the_rest_where_it_is(self):
		converted = self._mapping_holding(
			_tree(_leaf("Students of Courses", {"courses": ["Course A"], "payment_filter": "Paid"}))
		)
		left_alone = _tree(_leaf("Staff", {"staff_role": "Mentor"}))
		untouched = self._mapping_holding(left_alone)

		execute()

		leaf = self._stored(converted)["conditions"][0]
		self.assertEqual(leaf["rule_type"], "Student")
		self.assertEqual(
			leaf["config"],
			{
				"courses": ["Course A"],
				"payment_filter": "Paid",
				"student_scope": "Enrolled",
				"enrolled_in": "Courses",
			},
		)
		# A row the patch has nothing to say about is not rewritten at all, so a
		# mapping holding a condition with no equivalent keeps it verbatim.
		self.assertEqual(self._stored(untouched), left_alone)

	def test_execute_leaves_an_empty_scope_stored_as_it_was(self):
		name = self._mapping_holding(_tree(_leaf("Students of Batches", {"batches": []})))
		execute()
		self.assertEqual(self._stored(name)["conditions"][0]["rule_type"], "Students of Batches")

	def test_a_second_run_writes_nothing(self):
		name = self._mapping_holding(_tree(_leaf("Students of Courses", {"courses": ["Course A"]})))
		execute()
		after_first = frappe.db.get_value(
			"Raven Channel Mapping", name, ["member_rules_json", "modified"], as_dict=True
		)
		self.assertEqual(json.loads(after_first.member_rules_json)["conditions"][0]["rule_type"], "Student")

		execute()
		after_second = frappe.db.get_value(
			"Raven Channel Mapping", name, ["member_rules_json", "modified"], as_dict=True
		)
		self.assertEqual(after_second.member_rules_json, after_first.member_rules_json)
		# update_modified=False: a migration is not an edit anybody made, and the
		# timestamp is what the mapping's own staleness reads.
		self.assertEqual(after_second.modified, after_first.modified)


class TestMigrationWithoutRavenIntegration(UnitTestCase):
	def test_execute_is_a_noop_when_the_mapping_doctype_is_absent(self):
		if frappe.db.table_exists("Raven Channel Mapping"):
			self.skipTest("raven_integration is installed on this site")
		execute()
