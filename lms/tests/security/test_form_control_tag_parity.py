# Copyright (c) 2026, FOSS United and Contributors
# See license.txt
"""The backend and the SPA must forbid the same form controls.

Added with frappe/lms#2768, which introduced `lms/lms/html_sanitizer.py` to strip
form controls at write time. Its tag list only says "keep the two in sync" with
`safeHtmlLevels.ts`; nothing enforced it, and a tag added to one side alone would
mean stored HTML the SPA hides but email and exports still render.
"""

import re
import unittest
from pathlib import Path

from lms.lms.html_sanitizer import FORM_CONTROL_TAGS

SAFE_HTML_LEVELS = (
	Path(__file__).parent.parent.parent.parent / "frontend" / "src" / "directives" / "safeHtmlLevels.ts"
)
RICH_FORBID_TAGS = re.compile(r"rich:\s*\{.*?FORBID_TAGS:\s*\[(.*?)\]", re.DOTALL)


class TestFormControlTagParity(unittest.TestCase):
	def test_the_rich_profile_forbids_exactly_what_the_backend_strips(self):
		self.assertTrue(SAFE_HTML_LEVELS.exists(), f"{SAFE_HTML_LEVELS} moved; repoint this guard")

		match = RICH_FORBID_TAGS.search(SAFE_HTML_LEVELS.read_text())
		# Distinct from a parity failure on purpose: a restructured file is a broken
		# guard to repair, not a security regression to chase.
		self.assertIsNotNone(match, "could not find the rich profile's FORBID_TAGS; repair this guard")

		frontend = set(re.findall(r"'([^']+)'", match.group(1)))
		self.assertEqual(
			frontend,
			set(FORM_CONTROL_TAGS),
			"safeHtmlLevels.ts and html_sanitizer.FORM_CONTROL_TAGS have diverged. The SPA "
			"hides what it forbids; only the backend list keeps it out of email and exports.",
		)
