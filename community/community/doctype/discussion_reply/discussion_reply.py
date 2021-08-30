# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from community.widgets import Widgets

class DiscussionReply(Document):
    def after_insert(self):
        data = {
            "reply": self,
            "topic": {
                "name": self.topic
            },
            "widgets": Widgets()
        }
        template = frappe.render_template("community/templates/reply_card.html", data)
        topic_info = frappe.db.get_value("Discussion Topic", self.topic, ["reference_doctype", "reference_docname", "name", "title"], as_dict=True)
        frappe.publish_realtime(event="publish_message",
                                message = {
                                    "template": template,
                                    "topic_info": topic_info
                                },
                                after_commit=True)
