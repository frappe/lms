import frappe
from frappe.model.document import Document


class AIChatSession(Document):
    def before_insert(self):
        if not self.title:
            parts = []
            if self.course:
                parts.append(self.course)
            if self.lesson:
                parts.append(self.lesson)
            self.title = " | ".join(parts) or "AI Chat Session"

