import frappe


def execute():
	"""A certificate is shared with its learner to read and print. Shares made
	before that also let them edit it and pass it on, with the same rights; make
	every share of a certificate read-only."""
	share = frappe.qb.DocType("DocShare")
	(
		frappe.qb.update(share)
		.set(share.write, 0)
		.set(share.share, 0)
		.set(share.submit, 0)
		.where(share.share_doctype == "LMS Certificate")
		.where((share.write == 1) | (share.share == 1) | (share.submit == 1))
	).run()
