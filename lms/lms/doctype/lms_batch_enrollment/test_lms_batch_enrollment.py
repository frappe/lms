# Copyright (c) 2025, Frappe and Contributors
# See license.txt

from unittest.mock import Mock, patch

from frappe.tests import IntegrationTestCase, UnitTestCase

from lms.lms.doctype.lms_batch_enrollment.lms_batch_enrollment import LMSBatchEnrollment

# On IntegrationTestCase, the doctype test records and all
# link-field test record dependencies are recursively loaded
# Use these module variables to add/remove to/from that list
EXTRA_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]
IGNORE_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]


class UnitTestLMSBatchEnrollment(UnitTestCase):
	"""
	Unit tests for LMSBatchEnrollment.
	Use this class for testing individual functions and methods.
	"""

	def test_course_sync_is_deferred_until_after_insert(self):
		for is_new, should_sync in ((True, False), (False, True)):
			enrollment = Mock(spec=LMSBatchEnrollment)
			enrollment.is_new.return_value = is_new
			with patch(
				"lms.lms.doctype.lms_batch_enrollment.lms_batch_enrollment.validate_identity_unchanged"
			):
				LMSBatchEnrollment.validate(enrollment)
			self.assertEqual(enrollment.validate_course_enrollment.called, should_sync)


class IntegrationTestLMSBatchEnrollment(IntegrationTestCase):
	"""
	Integration tests for LMSBatchEnrollment.
	Use this class for testing interactions between multiple components.
	"""

	pass
