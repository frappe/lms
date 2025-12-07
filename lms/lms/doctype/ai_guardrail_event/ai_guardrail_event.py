from frappe.model.document import Document


class AIGuardrailEvent(Document):
    """Minimal controller for the AI Guardrail Event DocType.

    Present to satisfy import during schema sync and on_doctype_update.
    """

    pass


def on_doctype_update():
    # No special behavior required on schema updates for this DocType.
    pass

