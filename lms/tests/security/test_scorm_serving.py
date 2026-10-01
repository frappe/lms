# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

from lms.lms.test_helpers import BaseTestUtils
from lms.page_renderers import SCORMRenderer


class TestScormRendererClaim(BaseTestUtils):
	def test_claims_scorm_routes(self):
		for path in ("scorm/course/chapter/index.html", "/scorm/course/chapter"):
			with self.subTest(path=path):
				self.assertTrue(SCORMRenderer(path=path).can_render())

	def test_leaves_other_routes_alone(self):
		for path in ("guides/scorm/intro", "my-scorm/guide", "scormish/page", "blog/scorm/x/y"):
			with self.subTest(path=path):
				self.assertFalse(SCORMRenderer(path=path).can_render())
