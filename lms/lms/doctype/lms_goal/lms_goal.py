# Copyright (c) 2026, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

from lms.lms.utils import generate_slug


class LMSGoal(Document):
	_DOCTYPE_NAME = "LMS Goal"

	def autoname(self):
		# Named like courses and batches, so /lms/skills/posh-2026 reads as a place.
		if not self.name and self.title:
			self.name = generate_slug(self.title, self._DOCTYPE_NAME)
		# /skills/new is the builder for a skill that does not exist yet
		if self.name == "new":
			self.name = generate_slug(f"{self.title} skill", self._DOCTYPE_NAME)

	def on_trash(self):
		# Everything the skill owns goes with it: what its learners did and the AI sessions
		# behind it, then the knowledge base Lumi taught from, source by source so each
		# drops its vectors.
		sessions = self._sessions()
		self._delete_rows("LMS Goal Evidence", {"goal": self.name})
		self._delete_rows("LMS Goal Assignment", {"goal": self.name})
		self._delete_rows("Flow Session", {"name": ["in", sessions]})
		if self.knowledge_base:
			self._delete_rows("Flow Knowledge Source", {"knowledge_base": self.knowledge_base})
			self._delete_rows("Flow Knowledge Base", {"name": self.knowledge_base})

	def _sessions(self) -> list[str]:
		"""The drafter's session, each learner's tutor session and the sessions behind their evidence."""
		found = {self.drafting_session}
		found.update(frappe.get_all("LMS Goal Assignment", {"goal": self.name}, pluck="tutor_session"))
		found.update(frappe.get_all("LMS Goal Evidence", {"goal": self.name}, pluck="flow_session"))
		return [name for name in found if name]

	@staticmethod
	def _delete_rows(doctype: str, filters: dict) -> None:
		for name in frappe.get_all(doctype, filters=filters, pluck="name"):
			# nosemgrep: lms-unjustified-ignore-permissions - these rows belong to the skill being deleted by an admin who may delete it; learners and the knowledge base have no delete right of their own
			frappe.delete_doc(doctype, name, force=True, ignore_permissions=True)
