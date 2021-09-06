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
        template = frappe.render_template("community/templates/discussions/reply_card.html", data)
        topic_info = frappe.get_all("Discussion Topic", {"name": self.topic}, ["reference_doctype", "reference_docname", "name", "title", "owner", "creation"])
        sidebar = frappe.render_template("community/templates/discussions/sidebar.html", { "topic": topic_info[0], "widgets": Widgets() })
        new_topic_template = frappe.render_template("community/templates/discussions/reply_section.html", { "topics": topic_info, "widgets": Widgets() })

        frappe.publish_realtime(event="publish_message",
                                message = {
                                    "template": template,
                                    "topic_info": topic_info[0],
                                    "sidebar": sidebar,
                                    "new_topic_template": new_topic_template
                                },
                                after_commit=True)
