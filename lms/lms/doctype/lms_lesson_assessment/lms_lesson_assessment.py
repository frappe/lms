# Copyright (c) 2026, Frappe and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class LMSLessonAssessment(Document):
	# Derived rows, rebuilt from the lesson's own content on every save. Child doctypes
	# fire no doc_events, so the rebuild lives on Course Lesson, the document that saves.
	pass
