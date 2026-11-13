import frappe
from frappe.query_builder.functions import Count


def locked_count(doctype: str, filters: dict) -> int:
	"""COUNT(*) as a locking read, so it sees rows committed after this transaction's
	snapshot. It locks the scanned index range: filter on indexed columns, and call it
	after this transaction's own insert, or its gap lock can deadlock with a writer."""
	query = frappe.qb.get_query(doctype, filters=filters, fields=Count("*"), for_update=True)
	return query.run()[0][0]


def locked_get_all(doctype: str, filters: dict, fields: list[str]) -> list[dict]:
	"""locked_count's rows, for when the filters must stay narrow enough to pick one
	index and the rest of the condition is applied in Python."""
	query = frappe.qb.get_query(doctype, filters=filters, fields=fields, for_update=True)
	return query.run(as_dict=True)
