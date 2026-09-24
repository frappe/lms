# Copyright (c) 2026, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class LMSContentAuthor(Document):
	pass


class AuthoredDocument:
	"""`authors` — who is responsible for reusable content no single course owns.

	Mix in ahead of `Document` so `before_insert` resolves here; a controller that
	defines its own shadows this one and silently stops seeding the field. `owner`
	cannot do this job: it is the insert stamp, one user set once, while `authors`
	is several users and reassignable. Rows written before the field existed carry
	an empty `authors` and no patch fills them, so whatever reads it must fall back
	to `owner`.
	"""

	def before_insert(self):
		if not self.authors:
			self.append("authors", {"author": frappe.session.user})
