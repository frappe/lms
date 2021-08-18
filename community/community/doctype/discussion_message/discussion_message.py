# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from community.widgets import Widget, Widgets

class DiscussionMessage(Document):
    def after_insert(self):
        data = {
            "message": self,
            "widgets": Widgets()
        }
        template = frappe.render_template("community/templates/message_card.html", data)
        thread_info = frappe.db.get_value("Discussion Thread", self.thread, ["reference_doctype", "reference_docname"], as_dict=True)
        frappe.publish_realtime(event="publish_message",
                                message = {
                                    "thread": self.thread,
                                    "template": template,
                                    "thread_info": thread_info
                                },
                                after_commit=True)
