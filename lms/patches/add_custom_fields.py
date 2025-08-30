import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_field
from lms.lms.constants.custom_fields import CUSTOM_FIELDS

def execute():
    for doctype, fields in CUSTOM_FIELDS.items():
        for field in fields:
            print(f"Creating custom field '{field['fieldname']}' in doctype '{doctype}'")
            create_custom_field(doctype, field)