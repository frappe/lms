# Copyright (c) 2024, Frappe and Contributors
# See license.txt

from unittest.mock import MagicMock, patch  
  
import frappe  
from frappe.tests import UnitTestCase  
  
from lms.lms.doctype.lms_badge.lms_badge import (  
    LMSBadge,  
    assign_badge,  
    award,  
    eval_condition,  
    process_badges,  
)  
  
  
class TestLMSBadgeOnUpdate(UnitTestCase):
    """Tests para LMSBadge.on_update() - validación de condición."""

    def _create_badge_mock(self, event, condition):
        badge = MagicMock(spec=LMSBadge)
        badge.event = event
        badge.condition = condition
        return badge

	# UT-LMS-BDG-001
    def test_manual_assignment_validates_json(self):
        """Manual Assignment: condición válida e inválida."""
        badge_valid = self._create_badge_mock("Manual Assignment", '{"member": "x"}')
        LMSBadge.on_update(badge_valid)  # no debe lanzar

        badge_invalid = self._create_badge_mock("Manual Assignment", "invalid json {")
        with self.assertRaises(frappe.ValidationError):
            LMSBadge.on_update(badge_invalid)

	# UT-LMS-BDG-002
    def test_non_manual_validates_python(self):
        """Otros eventos: condición Python válida e inválida."""
        badge_valid = self._create_badge_mock("New", "doc.status == 'Active'")
        LMSBadge.on_update(badge_valid)  # no debe lanzar

        badge_invalid = self._create_badge_mock("Value Change", "def invalid !!!")
        with self.assertRaises(frappe.ValidationError):
            LMSBadge.on_update(badge_invalid)

	# UT-LMS-BDG-003
    def test_empty_condition_no_validation(self):
        """Sin condición (None o vacío) no ejecuta validación."""
        badge = self._create_badge_mock("Manual Assignment", None)
        LMSBadge.on_update(badge)  # no debe lanzar
        badge.condition = ""
        LMSBadge.on_update(badge)  # no debe lanzar


class TestLMSBadgeApply(UnitTestCase):
    """Tests para LMSBadge.apply()."""

	# UT-LMS-BDG-004
    def test_apply_calls_award_when_condition_satisfied(self):
        badge = MagicMock(spec=LMSBadge)
        badge.user_field = "member"
        doc = MagicMock()
        doc.get.return_value = "user@example.com"

        with patch.object(LMSBadge, "rule_condition_satisfied", return_value=True):
            with patch("lms.lms.doctype.lms_badge.lms_badge.award") as mock_award:
                LMSBadge.apply(badge, doc)
                mock_award.assert_called_once_with(badge, "user@example.com")


class TestLMSBadgeRuleConditionSatisfied(UnitTestCase):
    """Tests para LMSBadge.rule_condition_satisfied()."""

	# UT-LMS-BDG-005
    def test_new_event_with_before_save_returns_false(self):
        badge = MagicMock(spec=LMSBadge)
        badge.event = "New"
        badge.condition = "doc.status == 'Active'"
        doc = MagicMock()
        doc.get_doc_before_save.return_value = MagicMock()
        self.assertFalse(LMSBadge.rule_condition_satisfied(badge, doc))

	# UT-LMS-BDG-006
    def test_new_event_no_before_save_calls_eval(self):
        badge = MagicMock(spec=LMSBadge)
        badge.event = "New"
        badge.condition = "doc.status == 'Active'"
        doc = MagicMock()
        doc.get_doc_before_save.return_value = None
        with patch("lms.lms.doctype.lms_badge.lms_badge.eval_condition", return_value=True) as mock_eval:
            result = LMSBadge.rule_condition_satisfied(badge, doc)
            mock_eval.assert_called_once()
            self.assertTrue(result)

	# UT-LMS-BDG-007
    def test_non_new_event_calls_eval(self):
        badge = MagicMock(spec=LMSBadge)
        badge.event = "Value Change"
        badge.condition = "doc.score > 80"
        doc = MagicMock()
        doc.get_doc_before_save.return_value = MagicMock()
        with patch("lms.lms.doctype.lms_badge.lms_badge.eval_condition", return_value=True) as mock_eval:
            result = LMSBadge.rule_condition_satisfied(badge, doc)
            mock_eval.assert_called_once()
            self.assertTrue(result)

	# UT-LMS-BDG-008
    def test_no_condition_returns_false(self):
        badge = MagicMock(spec=LMSBadge)
        badge.event = "New"
        badge.condition = None
        doc = MagicMock()
        doc.get_doc_before_save.return_value = None
        self.assertFalse(LMSBadge.rule_condition_satisfied(badge, doc))
        badge.condition = ""
        self.assertFalse(LMSBadge.rule_condition_satisfied(badge, doc))


class TestAward(UnitTestCase):
    """Tests para award()."""

	# UT-LMS-BDG-009
    def test_grant_only_once_already_exists_returns_none(self):
        badge = MagicMock()
        badge.grant_only_once = True
        badge.name = "Badge"
        with patch("frappe.db.exists", return_value=True):
            self.assertIsNone(award(badge, "user@example.com"))

	# UT-LMS-BDG-010
    def test_grant_only_once_not_exists_creates_assignment(self):
        badge = MagicMock()
        badge.grant_only_once = True
        badge.name = "Badge"
        mock_assignment = MagicMock()
        mock_assignment.name = "BA-001"
        with patch("frappe.db.exists", return_value=False):
            with patch("frappe.new_doc", return_value=mock_assignment):
                with patch("frappe.utils.now", return_value="2024-01-01"):
                    result = award(badge, "user@example.com")
                    mock_assignment.update.assert_called_once()
                    mock_assignment.save.assert_called_once()
                    self.assertEqual(result, "BA-001")

	# UT-LMS-BDG-011
    def test_no_grant_only_once_always_creates(self):
        badge = MagicMock()
        badge.grant_only_once = False
        badge.name = "Badge"
        mock_assignment = MagicMock()
        mock_assignment.name = "BA-002"
        with patch("frappe.new_doc", return_value=mock_assignment):
            with patch("frappe.utils.now", return_value="2024-01-01"):
                with patch("frappe.db.exists") as mock_exists:
                    result = award(badge, "user@example.com")
                    mock_exists.assert_not_called()
                    mock_assignment.save.assert_called_once()
                    self.assertEqual(result, "BA-002")


class TestEvalCondition(UnitTestCase):
    """Tests para eval_condition()."""

	# UT-LMS-BDG-012
    def test_truthy_condition_calls_safe_eval(self):
        doc = MagicMock()
        doc.as_dict.return_value = {"status": "Active"}
        with patch("frappe.safe_eval", return_value=True) as mock_eval:
            result = eval_condition(doc, "doc.status == 'Active'")
            mock_eval.assert_called_once_with(
                "doc.status == 'Active'", None, {"doc": {"status": "Active"}}
            )
            self.assertTrue(result)

	# UT-LMS-BDG-013
    def test_empty_condition_returns_false_without_eval(self):
        doc = MagicMock()
        with patch("frappe.safe_eval") as mock_eval:
            self.assertFalse(eval_condition(doc, ""))
            mock_eval.assert_not_called()

	# UT-LMS-BDG-014
    def test_none_condition_returns_none_without_eval(self):
        doc = MagicMock()
        with patch("frappe.safe_eval") as mock_eval:
            self.assertIsNone(eval_condition(doc, None))
            mock_eval.assert_not_called()


class TestAssignBadge(UnitTestCase):
    """Tests para assign_badge()."""

	# UT-LMS-BDG-015
    def test_badge_not_found_raises(self):
        with patch("frappe.only_for"):
            with patch("frappe.db.get_value", return_value=None):
                with self.assertRaises(frappe.DoesNotExistError):
                    assign_badge("MissingBadge")
	
	# UT-LMS-BDG-016
    def test_non_manual_event_returns_none(self):
        badge_data = frappe._dict(
            name="Badge", event="New", reference_doctype="LMS Enrollment",
            condition="{}", user_field="member"
        )
        with patch("frappe.only_for"):
            with patch("frappe.db.get_value", return_value=badge_data):
                self.assertIsNone(assign_badge("Badge"))

	# UT-LMS-BDG-017
    def test_manual_assignment_with_docs_returns_success(self):
        badge_data = frappe._dict(
            name="Badge", event="Manual Assignment", reference_doctype="LMS Enrollment",
            condition='{"status":"Active"}', user_field="member"
        )
        docs = [frappe._dict(name="ERL-001", member="user@example.com")]
        with patch("frappe.only_for"):
            with patch("frappe.db.get_value", return_value=badge_data):
                with patch("frappe.get_all", return_value=docs):
                    with patch("lms.lms.doctype.lms_badge.lms_badge.award", return_value="BA-001"):
                        self.assertEqual(assign_badge("Badge"), "success")

	# UT-LMS-BDG-018
    def test_manual_assignment_no_docs_returns_failed(self):
        badge_data = frappe._dict(
            name="Badge", event="Manual Assignment", reference_doctype="LMS Enrollment",
            condition="{}", user_field="member"
        )
        with patch("frappe.only_for"):
            with patch("frappe.db.get_value", return_value=badge_data):
                with patch("frappe.get_all", return_value=[]):
                    self.assertEqual(assign_badge("Badge"), "failed")
	
	# UT-LMS-BDG-019
    def test_manual_assignment_award_returns_none_returns_failed(self):
        badge_data = frappe._dict(
            name="Badge", event="Manual Assignment", reference_doctype="LMS Enrollment",
            condition='{"status":"Active"}', user_field="member"
        )
        docs = [frappe._dict(name="ERL-001", member="user@example.com")]
        with patch("frappe.only_for"):
            with patch("frappe.db.get_value", return_value=badge_data):
                with patch("frappe.get_all", return_value=docs):
                    with patch("lms.lms.doctype.lms_badge.lms_badge.award", return_value=None):
                        self.assertEqual(assign_badge("Badge"), "failed")


class TestProcessBadges(UnitTestCase):
    """Tests para process_badges()."""

	# UT-LMS-BDG-020
    def test_skips_when_any_global_flag_is_set(self):
        """Verifica que si algún flag especial está activo, la función retorna sin procesar."""
        doc = MagicMock()
        flags = ["in_patch", "in_install", "in_migrate", "in_import", "in_setup_wizard"]
        for flag in flags:
            with self.subTest(flag=flag):
                setattr(frappe.flags, flag, True)
                try:
                    with patch("frappe.cache_manager.get_doctype_map") as mock_cache:
                        process_badges(doc, "on_update")
                        mock_cache.assert_not_called()
                finally:
                    setattr(frappe.flags, flag, False)

	# UT-LMS-BDG-021
    def test_normal_flow_with_badges_calls_apply(self):
        doc = MagicMock()
        doc.doctype = "LMS Enrollment"
        for flag in ["in_patch", "in_install", "in_migrate", "in_import", "in_setup_wizard"]:
            setattr(frappe.flags, flag, False)

        badge_entries = [{"name": "Badge1"}, {"name": "Badge2"}]
        mock_badge = MagicMock()
        with patch("frappe.cache_manager.get_doctype_map", return_value=badge_entries):
            with patch("frappe.get_doc", return_value=mock_badge):
                process_badges(doc, "on_update")
                self.assertEqual(mock_badge.apply.call_count, 2)

	# UT-LMS-BDG-022
    def test_normal_flow_no_badges_does_nothing(self):
        doc = MagicMock()
        doc.doctype = "LMS Enrollment"
        for flag in ["in_patch", "in_install", "in_migrate", "in_import", "in_setup_wizard"]:
            setattr(frappe.flags, flag, False)

        with patch("frappe.cache_manager.get_doctype_map", return_value=[]):
            with patch("frappe.get_doc") as mock_get_doc:
                process_badges(doc, "on_update")
                mock_get_doc.assert_not_called()