import frappe


def execute():
	"""Add a composite index backing the (member, lesson, source) lookup in
	track_video_watch_duration. Without it every call is a full table scan and
	the table grows one row per user x lesson x video. Idempotent: add_index
	checks has_index and uses ADD INDEX IF NOT EXISTS."""
	if not frappe.db.table_exists("LMS Video Watch Duration"):
		return

	frappe.db.add_index("LMS Video Watch Duration", ["member", "lesson", "source"])
