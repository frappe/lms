from frappe.model.document import Document


class AIFAQItem(Document):
    """Table DocType for AI FAQ items (question/answer rows)."""

    pass


def on_doctype_update():
    # No special behavior required on schema updates for this DocType.
    pass

