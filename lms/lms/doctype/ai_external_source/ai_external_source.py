from frappe.model.document import Document


class AIExternalSource(Document):
    """Represents an external content source attached to a lesson/course for RAG."""

    pass


def on_doctype_update():
    # No special behavior required on schema updates for this DocType.
    pass

