import frappe
from frappe import _

# A Rating field stores stars / 5, and 0 when the student left it blank. Two
# stars or fewer is "low"; a blank rating is neither low nor part of an average.
LOW_RATING = 0.4

# The dashboard card shows this many comments; the dialog pages the rest.
LATEST_COMMENTS = 2


def is_low_rating(rating):
	return (rating > 0) & (rating <= LOW_RATING)


def validate_feedback_page(low_only: bool, start: int, page_length: int) -> None:
	if not isinstance(low_only, bool):
		frappe.throw(_("Pass low_only as true or false."), title=_("Invalid filter"))
	for value in (start, page_length):
		if not isinstance(value, int) or isinstance(value, bool) or value < 0:
			frappe.throw(
				_("Pass start and page_length as whole numbers, 0 or more."), title=_("Invalid page")
			)
