# Copyright (c) 2023, Frappe and contributors
# For license information, please see license.txt

from frappe.model.document import Document

from lms.lms.schedule_utils import validate_schedule_fields


class LMSAssignment(Document):
	def validate(self):
		validate_schedule_fields(self)
