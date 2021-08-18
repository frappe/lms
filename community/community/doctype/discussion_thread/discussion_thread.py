# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class DiscussionThread(Document):
    pass

@frappe.whitelist()
def submit_discussion(doctype, docname, message, title=None, thread_name=None):
    thread = []
    filters = {}
    if doctype and docname:
        filters = {
                    "reference_doctype": doctype,
                    "reference_docname": docname
                }

    elif thread_name:
        filters = {
            "name": thread_name
        }

    if filters:
        thread = frappe.get_all("Discussion Thread",filters)
    if len(thread):
        thread = thread[0]
        save_message(message, thread)

    else:
        thread = frappe.get_doc({
                    "doctype": "Discussion Thread",
                    "title": title,
                    "reference_doctype": doctype,
                    "reference_docname": docname
                })
        thread.save(ignore_permissions=True)
        save_message(message, thread)

    return thread.name

def save_message(message, thread):
        frappe.get_doc({
            "doctype": "Discussion Message",
            "message": message,
            "thread": thread.name
        }).save(ignore_permissions=True)
