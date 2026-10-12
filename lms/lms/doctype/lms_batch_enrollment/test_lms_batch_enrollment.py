from unittest.mock import Mock, patch

from frappe.tests import UnitTestCase

from lms.lms.doctype.lms_batch_enrollment.lms_batch_enrollment import LMSBatchEnrollment


class UnitTestLMSBatchEnrollment(UnitTestCase):
	def test_course_sync_runs_only_on_existing_records(self):
		for is_new, should_sync in ((True, False), (False, True)):
			enrollment = Mock(spec=LMSBatchEnrollment)
			enrollment.is_new.return_value = is_new
			with patch(
				"lms.lms.doctype.lms_batch_enrollment.lms_batch_enrollment.validate_identity_unchanged"
			):
				LMSBatchEnrollment.validate(enrollment)
			self.assertEqual(enrollment.validate_course_enrollment.called, should_sync)
