# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import getdate

class Slot(Document):

	def before_save(self):
		event = frappe.get_doc("Event Details", self.event)
		if getdate(self.date) < event.start_date or getdate(self.date) > event.end_date:
			frappe.throw("Slot should be in Event's span") 

