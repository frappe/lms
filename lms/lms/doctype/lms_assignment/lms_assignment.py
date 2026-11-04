# Copyright (c) 2023, Frappe and contributors
# For license information, please see license.txt

from frappe.model.document import Document

from lms.lms.doctype.lms_content_author.lms_content_author import AuthoredDocument
from lms.lms.schedule_utils import validate_schedule_fields
from lms.lms.utils import generate_slug


class LMSAssignment(AuthoredDocument, Document):
	def autoname(self):
		# Insert only, so ASG-##### names and live URLs survive a retitle. "new" is
		# the form's create route, so a title slugging to it takes "new-2".
		if not self.name:
			self.name = generate_slug(self.title, "LMS Assignment", reserved=frozenset({"new"}))

	def validate(self):
		validate_schedule_fields(self)
