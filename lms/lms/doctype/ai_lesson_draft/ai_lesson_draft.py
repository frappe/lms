from frappe.model.document import Document


class AILessonDraft(Document):
    """Draft content (summary/glossary) generated for a lesson."""

    pass


def on_doctype_update():
    # No special behavior required on schema updates for this DocType.
    pass

