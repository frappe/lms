import frappe


@frappe.whitelist()
def search_sqlite(query: str):
	from lms.sqlite import LearningSearch, LearningSearchIndexMissingError

	search = LearningSearch()

	try:
		result = search.search(query)
	except LearningSearchIndexMissingError:
		return []

	groups = {}
	print(result)
	for r in result["results"]:
		doctype = r["doctype"]

		if doctype == "LMS Course":
			groups.setdefault("Courses", []).append(r)
		elif doctype == "LMS Batch":
			groups.setdefault("Batches", []).append(r)

	out = []
	for key in groups:
		out.append({"title": key, "items": groups[key]})

	return out
