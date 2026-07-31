import frappe

from lms.lms.api import get_unsplash_photos
from lms.lms.test_helpers import BaseTestUtils


class TestUnsplashPhotos(BaseTestUtils):
	"""Unsplash needs an access key that most sites never set. When it is
	missing the request helper returns None, which used to reach
	`data.get("results")` and 500 on every keyword search, and cache a null
	list for the unfiltered call — so the cover-image picker rendered an
	empty grid with no explanation for every role."""

	def setUp(self):
		super().setUp()
		self.original_key = frappe.db.get_single_value("LMS Settings", "unsplash_access_key")
		frappe.db.set_single_value("LMS Settings", "unsplash_access_key", "")
		frappe.cache().delete_value("unsplash_photos")

	def tearDown(self):
		frappe.db.set_single_value("LMS Settings", "unsplash_access_key", self.original_key)
		frappe.cache().delete_value("unsplash_photos")
		super().tearDown()

	def test_keyword_search_returns_empty_list_when_unconfigured(self):
		self.assertEqual(get_unsplash_photos("mountain"), [])

	def test_listing_returns_empty_list_when_unconfigured(self):
		self.assertEqual(get_unsplash_photos(), [])

	def test_empty_result_is_not_cached(self):
		"""A site that adds the access key later must not keep serving the
		empty list the unconfigured call produced."""
		get_unsplash_photos()
		self.assertFalse(frappe.cache().get_value("unsplash_photos"))

	def test_non_string_keyword_is_rejected(self):
		"""Two layers reject a non-string keyword, and which one fires depends on
		the caller. Inside a request or a test frappe validates the `str`
		annotation first and raises FrappeTypeError; a background job or script
		skips that check (`_in_request_or_test`) and hits the isinstance guard,
		which throws ValidationError. Either way the value never reaches the
		Unsplash request."""
		for bad in ([">", "x"], {"like": "%"}, 7):
			with self.assertRaises((frappe.ValidationError, frappe.exceptions.FrappeTypeError)):
				get_unsplash_photos(bad)
