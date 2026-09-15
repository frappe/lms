# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

import importlib
import pkgutil
from pathlib import Path

import frappe
from frappe.tests.utils import FrappeTestCase

import lms

BASELINE = Path(__file__).parent / "guest_endpoints.txt"

# frappe.whitelist(allow_guest=True) records the function in frappe.guest_methods.
# It does NOT set an `allow_guest` attribute on it, so attribute-based discovery
# finds nothing and looks exactly like a clean app. CONTROL exists so that failure
# mode is a red test rather than a silent pass.
CONTROL = "lms.lms.user.sign_up"


def _guest_endpoints():
	for mod in pkgutil.walk_packages(lms.__path__, prefix="lms."):
		try:
			importlib.import_module(mod.name)
		except Exception:
			continue

	found = set()
	for fn in frappe.guest_methods:
		module = getattr(fn, "__module__", "") or ""
		if module == "lms" or module.startswith("lms."):
			found.add(f"{module}.{fn.__qualname__}")
	return found


class TestGuestSurface(FrappeTestCase):
	def test_discovery_finds_a_known_guest_endpoint(self):
		self.assertIn(
			CONTROL,
			_guest_endpoints(),
			f"{CONTROL} is whitelisted with allow_guest=True but discovery did not find "
			"it. The snapshot below is therefore meaningless — fix discovery before "
			"trusting a passing run.",
		)

	def test_guest_surface_matches_baseline(self):
		baseline = {
			line.strip()
			for line in BASELINE.read_text().splitlines()
			if line.strip() and not line.startswith("#")
		}
		found = _guest_endpoints()
		added = sorted(found - baseline)
		removed = sorted(baseline - found)
		self.assertEqual(
			(added, removed),
			([], []),
			f"guest surface changed. Added: {added}. Removed: {removed}. "
			"Every allow_guest endpoint is reachable unauthenticated. If this "
			"is intended, add it to lms/tests/guest_endpoints.txt in the same "
			"commit so the change is reviewed.",
		)
