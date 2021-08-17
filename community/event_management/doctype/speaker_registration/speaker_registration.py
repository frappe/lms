# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class SpeakerRegistration(Document):
	
	def on_update(self):
		abc = frappe.get_doc("Speaker Registration", 'SPEAKER-REGIS0001')
		print(type(abc))
