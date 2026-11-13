from unittest.mock import patch

import frappe

from lms.lms.ai import connect
from lms.lms.test_helpers import BaseTestUtils

GEMINI = [
	"gemini/gemini-2.5-flash",
	"gemini/gemini-3.5-flash",
	"gemini/gemini-3.5-flash-image",
	"gemini/gemini-embedding-001",
	"gemini/gemini-embedding-2",
]
ANTHROPIC = ["anthropic/claude-haiku-4-5", "anthropic/claude-sonnet-5-5"]


class TestConnect(BaseTestUtils):
	"""One key, two models: the provider's everyday chat model and its embedding model."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.saved = []
		frappe.db.set_single_value("Flow Knowledge Settings", "embedding_model", None)

	def _add_model(self, provider, model, for_chat):
		self.saved.append((provider, model, for_chat))
		if model == "gemini-3.5-flash" and for_chat:
			return {"check": {"reason": "failed"}}  # the first choice is down today
		return {"name": f"{provider}:{model}", "check": {"ok": True}}

	def test_picks_the_everyday_models_and_sets_search_up(self):
		with (
			patch("frappe.flow.api.setup.connect", return_value={"ok": True}),
			patch.object(connect, "_provider_models", return_value=GEMINI),
			patch.object(connect, "_add_model", side_effect=self._add_model),
			patch.object(
				connect, "status", side_effect=[{"chat_model": None}, {"chat_model": "x", "ready": True}]
			),
			patch.object(connect, "_set_embedding") as set_embedding,
		):
			result = connect.connect("gemini", "key")
		self.assertTrue(result["ok"])
		# The preferred chat model failed, so the next one was saved; image models were never tried.
		self.assertEqual([m for p, m, chat in self.saved if chat], ["gemini-3.5-flash", "gemini-2.5-flash"])
		self.assertEqual([m for p, m, chat in self.saved if not chat], ["gemini-embedding-001"])
		set_embedding.assert_called_once_with("gemini:gemini-embedding-001")

	def test_a_refused_key_saves_nothing_and_says_why(self):
		with (
			patch(
				"frappe.flow.api.setup.connect",
				return_value={
					"ok": False,
					"reason": "wrong_key",
					"message": "Gemini didn't accept this key.",
				},
			),
			patch.object(connect, "_add_model") as add_model,
		):
			result = connect.connect("gemini", "bad")
		self.assertEqual(result, {"ok": False, "message": "Gemini didn't accept this key."})
		add_model.assert_not_called()

	def test_a_provider_without_embeddings_asks_for_a_second_key(self):
		with (
			patch("frappe.flow.api.setup.connect", return_value={"ok": True}),
			patch.object(connect, "_provider_models", return_value=ANTHROPIC),
			patch.object(connect, "_add_model", side_effect=self._add_model),
			patch.object(
				connect,
				"status",
				side_effect=[
					{"chat_model": None},
					{
						"chat_model": "anthropic:claude-sonnet-5-5",
						"embedding_model": None,
						"ready": False,
						"embedding_needs_other_key": True,
					},
				],
			),
		):
			result = connect.connect("anthropic", "key")
		self.assertEqual([m for p, m, chat in self.saved], ["claude-sonnet-5-5"])
		self.assertTrue(result["embedding_needs_other_key"])
		self.assertFalse(frappe.db.get_single_value("Flow Knowledge Settings", "embedding_model"))

	def test_a_second_key_only_brings_search(self):
		with (
			patch("frappe.flow.api.setup.connect", return_value={"ok": True}),
			patch.object(connect, "_provider_models", return_value=GEMINI),
			patch.object(connect, "_add_model", side_effect=self._add_model),
			patch.object(connect, "status", return_value={"ready": True}),
			patch.object(connect, "_set_embedding"),
		):
			connect.connect("gemini", "key", embedding_only=True)
		self.assertEqual(self.saved, [("gemini", "gemini-embedding-001", False)])

	def test_only_listed_providers_and_only_admins(self):
		with self.assertRaises(frappe.ValidationError):
			connect.connect("mystery", "key")
		learner = self._create_user("connect-learner@example.com", "Connect", "Learner", ["LMS Student"]).name
		frappe.set_user(learner)
		with self.assertRaises(frappe.PermissionError):
			connect.connect("gemini", "key")

	def test_ranking_prefers_the_named_models_then_sensible_fallbacks(self):
		ranked = connect._ranked(
			["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3.5-flash", "gemini-3.5-flash-image"],
			connect.CHAT_PREFERENCES["gemini"],
			connect.CHAT_FALLBACK,
			chat=True,
		)
		self.assertEqual(ranked, ["gemini-3.5-flash", "gemini-2.5-flash"])
		self.assertEqual(
			connect._ranked(["foo-embed-v1", "foo-chat"], (), connect.EMBEDDING_FALLBACK), ["foo-embed-v1"]
		)
