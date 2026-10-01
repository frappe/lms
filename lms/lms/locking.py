import frappe
from frappe.query_builder.functions import Count


def locked_count(doctype: str, filters: dict) -> int:
	"""COUNT(*) as a locking read, so it sees rows committed after this transaction's
	snapshot. It locks the scanned index range: filter on indexed columns, and call it
	after this transaction's own insert, or its gap lock can deadlock with a writer."""
	query = frappe.qb.get_query(doctype, filters=filters, fields=Count("*"), for_update=True)
	return query.run()[0][0]
