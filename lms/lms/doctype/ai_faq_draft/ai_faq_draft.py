from frappe.model.document import Document


class AIFAQDraft(Document):
    """Minimal controller for the AI FAQ Draft DocType.

    This file exists so Frappe can import the module during install/migrate
    when running `DocType.on_update` → `on_doctype_update` hook resolution.
    """

    pass


def on_doctype_update():
    # No special patching required on schema changes for this DocType.
    pass

