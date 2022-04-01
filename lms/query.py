"""Utilities to find docs.
"""
import frappe

def find_all(doctype, order_by=None, **filters):
    """Queries the database for documents of a doctype matching given filters.
    """
    rows = frappe.db.get_all(doctype,
        filters=filters,
        fields='*',
        order_by=order_by)
    return [frappe.get_doc(dict(row, doctype=doctype)) for row in rows]

def find(doctype, **filters):
    """Queries the database for a document of given doctype matching given filters.
    """
    rows = frappe.db.get_all(doctype,
        filters=filters,
        fields='*')
    if rows:
        row = rows[0]
        return frappe.get_doc(dict(row, doctype=doctype))
