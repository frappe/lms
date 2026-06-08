# Copyright (c) 2024, Frappe and Contributors
# See license.txt

from unittest.mock import MagicMock, patch

import frappe
from frappe.tests import UnitTestCase

from lms.lms.doctype.lms_badge_assignment.lms_badge_assignment import LMSBadgeAssignment


class TestLMSBadgeAssignment(UnitTestCase):
    def setUp(self):
        self.doc = MagicMock(spec=LMSBadgeAssignment)
        self.doc.badge = "Test Badge"
        self.doc.member = "user@example.com"
        self.doc.name = "BA-001"

    # UT-LMS-BDGASSIGN-001
    def test_validate_calls_all_three_methods(self):
        """validate() debe llamar a los tres métodos de validación."""
        LMSBadgeAssignment.validate(self.doc)
        self.doc.validate_duplicate_badge_assignment.assert_called_once()
        self.doc.validate_badge_criteria.assert_called_once()
        self.doc.validate_owner.assert_called_once()

	# UT-LMS-BDGASSIGN-002
    def test_validate_owner_non_manual_event_skips(self):
        """Evento != Manual Assignment, no verifica roles."""
        with patch("frappe.db.get_value", return_value="New"):
            with patch("frappe.get_roles") as mock_roles:
                LMSBadgeAssignment.validate_owner(self.doc)
                mock_roles.assert_not_called()

	# UT-LMS-BDGASSIGN-003
    def test_validate_owner_manual_allowed_role(self):
        """Manual Assignment + rol permitido (Moderator), no lanza."""
        with patch("frappe.db.get_value", return_value="Manual Assignment"):
            with patch("frappe.get_roles", return_value=["Moderator"]):
                LMSBadgeAssignment.validate_owner(self.doc)

	# UT-LMS-BDGASSIGN-004
    def test_validate_owner_manual_forbidden_role_throws(self):
        """Manual Assignment + rol no permitido, lanza ValidationError."""
        with patch("frappe.db.get_value", return_value="Manual Assignment"):
            with patch("frappe.get_roles", return_value=["LMS Student"]):
                with self.assertRaises(frappe.ValidationError):
                    LMSBadgeAssignment.validate_owner(self.doc)

   # UT-LMS-BDGASSIGN-005
    def test_duplicate_grant_only_once_false_skips(self):
        """grant_only_once = False, retorna sin verificar existencia."""
        with patch("frappe.db.get_value", return_value=False):
            with patch("frappe.db.exists") as mock_exists:
                LMSBadgeAssignment.validate_duplicate_badge_assignment(self.doc)
                mock_exists.assert_not_called()

	# UT-LMS-BDGASSIGN-006
    def test_duplicate_no_existing_assignment_ok(self):
        """grant_only_once = True y sin duplicado, no lanza."""
        with patch("frappe.db.get_value", return_value=True):
            with patch("frappe.db.exists", return_value=False):
                LMSBadgeAssignment.validate_duplicate_badge_assignment(self.doc)

	# UT-LMS-BDGASSIGN-007
    def test_duplicate_existing_assignment_throws(self):
        """grant_only_once = True y ya existe asignación, lanza ValidationError."""
        with patch("frappe.db.get_value", return_value=True):
            with patch("frappe.db.exists", return_value=True):
                with self.assertRaises(frappe.ValidationError):
                    LMSBadgeAssignment.validate_duplicate_badge_assignment(self.doc)

	# UT-LMS-BDGASSIGN-008
    def test_criteria_badge_details_none_skips(self):
        """badge_details = None, retorna sin consultar documentos."""
        with patch("frappe.db.get_value", return_value=None):
            with patch("frappe.get_all") as mock_get_all:
                LMSBadgeAssignment.validate_badge_criteria(self.doc)
                mock_get_all.assert_not_called()

	# UT-LMS-BDGASSIGN-009
    def test_criteria_missing_fields_skips(self):
        """Falta reference_doctype, user_field o condition, retorna sin validar."""
        badge_details = frappe._dict(reference_doctype=None, user_field="member", condition="{}")
        with patch("frappe.db.get_value", return_value=badge_details):
            with patch("frappe.get_all") as mock_get_all:
                LMSBadgeAssignment.validate_badge_criteria(self.doc)
                mock_get_all.assert_not_called()

	# UT-LMS-BDGASSIGN-010
    def test_criteria_no_documents_throws(self):
        """Existen campos pero no hay documentos del miembro, lanza ValidationError."""
        badge_details = frappe._dict(
            reference_doctype="LMS Enrollment",
            user_field="member",
            condition="doc.status == 'Active'",
            enabled=1,
        )
        with patch("frappe.db.get_value", side_effect=[badge_details, "member"]):
            with patch("frappe.get_all", return_value=[]):
                with self.assertRaises(frappe.ValidationError):
                    LMSBadgeAssignment.validate_badge_criteria(self.doc)

	# UT-LMS-BDGASSIGN-011
    def test_criteria_condition_false_for_all_throws(self):
        """Documentos existen pero ningún cumple la condición, lanza ValidationError."""
        badge_details = frappe._dict(
            reference_doctype="LMS Enrollment",
            user_field="member",
            condition="doc.status == 'Active'",
            enabled=1,
        )
        documents = [frappe._dict(name="ENR-001"), frappe._dict(name="ENR-002")]
        mock_ref_doc = MagicMock()
        with patch("frappe.db.get_value", side_effect=[badge_details, "member"]):
            with patch("frappe.get_all", return_value=documents):
                with patch("frappe.get_doc", return_value=mock_ref_doc):
                    with patch("lms.lms.doctype.lms_badge_assignment.lms_badge_assignment.eval_condition", return_value=False):
                        with self.assertRaises(frappe.ValidationError):
                            LMSBadgeAssignment.validate_badge_criteria(self.doc)

	# UT-LMS-BDGASSIGN-012
    def test_criteria_condition_true_passes(self):
        """Al menos un documento cumple la condición, retorna sin lanzar excepción."""
        badge_details = frappe._dict(
            reference_doctype="LMS Enrollment",
            user_field="member",
            condition="doc.status == 'Active'",
            enabled=1,
        )
        documents = [frappe._dict(name="ENR-001")]
        mock_ref_doc = MagicMock()
        with patch("frappe.db.get_value", side_effect=[badge_details, "member"]):
            with patch("frappe.get_all", return_value=documents):
                with patch("frappe.get_doc", return_value=mock_ref_doc):
                    with patch("lms.lms.doctype.lms_badge_assignment.lms_badge_assignment.eval_condition", return_value=True):
                        LMSBadgeAssignment.validate_badge_criteria(self.doc)