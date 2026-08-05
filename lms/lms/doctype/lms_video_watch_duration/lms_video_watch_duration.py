# Copyright (c) 2025, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class LMSVideoWatchDuration(Document):
	pass


def on_doctype_update():
	# Backs the (member, lesson, source) lookup in track_video_watch_duration.
	# Runs on every doctype sync (fresh install + re-sync), so new sites get the
	# index that the one-time patch only adds to existing sites. Idempotent.
	frappe.db.add_index("LMS Video Watch Duration", ["member", "lesson", "source"])
