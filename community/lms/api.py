"""API methods for the LMS.
"""

import frappe

@frappe.whitelist()
def autosave_section(section, code):
    """Saves the code edited in one of the sections.
    """
    doc = frappe.get_doc(
        doctype="Code Revision",
        section=section,
        code=code,
        author=frappe.session.user)
    doc.insert()
    return {"name": doc.name}

@frappe.whitelist()
def get_section(name):
    """Saves the code edited in one of the sections.
    """
    doc = frappe.get_doc("LMS Section", name)
    return doc and doc.as_dict()
