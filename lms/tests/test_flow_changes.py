from types import SimpleNamespace
from unittest.mock import patch

import frappe
from frappe.auth import set_agent
from frappe.tests import IntegrationTestCase

from lms.lms import flow


class TestFlowChanges(IntegrationTestCase):
	"""A record Flow writes is announced to the LMS pages of the user it acts for."""

	def setUp(self):
		frappe.set_user("Administrator")
		self.addCleanup(frappe.session.data.pop, "agent", None)

	def act_as_flow(self):
		with patch.object(frappe.local, "session_obj", None, create=True):
			set_agent("Flow", "Flow", "Flow Session", "test-session")

	def published(self, doc, method="on_change"):
		with patch("frappe.publish_realtime") as publish:
			flow.publish_flow_change(doc, method)
		return publish

	def course(self):
		return SimpleNamespace(doctype="LMS Course", name="flow-course", meta=frappe._dict(istable=0))

	def test_the_users_own_writes_are_not_announced(self):
		self.published(self.course()).assert_not_called()

	def test_another_agents_writes_are_not_announced(self):
		with patch.object(frappe.local, "session_obj", None, create=True):
			set_agent("Some Bot", "API")
		self.published(self.course()).assert_not_called()

	def test_flow_write_reaches_the_users_room_after_commit(self):
		self.act_as_flow()
		self.published(self.course()).assert_called_once_with(
			flow.FLOW_CHANGE_EVENT,
			{"doctype": "LMS Course", "name": "flow-course", "deleted": False, "values": {}},
			user="Administrator",
			after_commit=True,
		)

	def test_flow_write_carries_the_fields_its_page_is_addressed_by(self):
		self.act_as_flow()
		lesson = SimpleNamespace(
			doctype="Course Lesson", name="l1", course="c1", chapter="ch1", meta=frappe._dict(istable=0)
		)
		payload = self.published(lesson).call_args.args[1]
		self.assertEqual(payload["values"], {"course": "c1"})

	def test_flow_delete_says_so(self):
		self.act_as_flow()
		publish = self.published(self.course(), "on_trash")
		self.assertTrue(publish.call_args.args[1]["deleted"])

	def test_child_rows_are_left_to_their_parent(self):
		self.act_as_flow()
		row = SimpleNamespace(doctype="Lesson Reference", name="row", meta=frappe._dict(istable=1))
		self.published(row).assert_not_called()

	def test_records_of_other_apps_are_not_announced(self):
		self.act_as_flow()
		version = SimpleNamespace(doctype="Version", name="v1", meta=frappe._dict(istable=0))
		self.published(version).assert_not_called()

	def test_saving_any_doctype_runs_the_hook(self):
		self.act_as_flow()
		with patch("lms.lms.flow.publish_flow_change") as hook:
			category = frappe.get_doc({"doctype": "LMS Category", "category": "Flow Change Test"}).insert()
			self.addCleanup(category.delete)
		self.assertIn(category.name, [call.args[0].name for call in hook.call_args_list])
