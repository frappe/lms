"""Connecting an AI provider in one step: the admin pastes one key, Learning asks Flow to check
and save it, then picks that provider's everyday chat model and its embedding model, so Lumi
can draft, tutor and search material without anyone choosing models by hand.

Flow owns providers and models; this module only drives Flow's own setup calls.
"""

import re

import frappe
from frappe import _

from lms.lms.permissions import require_learning_admin

# The services the first run offers, in the order shown. "embeds" says whether one key of
# theirs also covers embeddings; without that, search needs a second key.
PROVIDERS = (
	{"name": "gemini", "label": "Google Gemini", "embeds": True},
	{"name": "openai", "label": "OpenAI", "embeds": True},
	{"name": "openrouter", "label": "OpenRouter", "embeds": True},
	{"name": "anthropic", "label": "Anthropic", "embeds": False},
	{"name": "groq", "label": "Groq", "embeds": False},
	{"name": "deepseek", "label": "DeepSeek", "embeds": False},
	{"name": "xai", "label": "xAI", "embeds": False},
)

# What to teach with, per provider, most wanted first: a current, quick, inexpensive model
# that follows tool calls well. Patterns match the model id without the provider prefix.
CHAT_PREFERENCES = {
	"gemini": (r"^gemini-3\.5-flash$", r"^gemini-3-flash$", r"^gemini-2\.5-flash$", r"^gemini-.*-flash$"),
	"openai": (r"^gpt-5\.4-mini$", r"^gpt-5-mini$", r"^gpt-4\.1-mini$", r"^gpt-.*-mini$"),
	"openrouter": (
		r"^anthropic/claude-sonnet-5\.5$",
		r"^anthropic/claude-sonnet-4\.5$",
		r"^google/gemini-3\.5-flash$",
		r"^openai/gpt-5\.4-mini$",
		r"^anthropic/claude-sonnet",
	),
	"anthropic": (r"^claude-sonnet-5-5", r"^claude-sonnet-4-5", r"^claude-sonnet"),
	"groq": (r"^openai/gpt-oss-120b$", r"^openai/gpt-oss-20b$", r"llama"),
	"deepseek": (r"^deepseek-chat$", r"^deepseek"),
	"xai": (r"^grok-4", r"^grok-3", r"^grok"),
}
CHAT_FALLBACK = (r"(^|[-/])flash($|[-/])", r"(^|[-/])mini($|[-/])", r"sonnet", r"haiku", r"(^|/)gpt-")

# What to search with. Older entries still exist on every account and embed well.
EMBEDDING_PREFERENCES = {
	"gemini": (r"^gemini-embedding-001$", r"^gemini-embedding-2$", r"^gemini-embedding"),
	"openai": (r"^text-embedding-3-small$", r"^text-embedding-3-large$", r"^text-embedding"),
	"openrouter": (
		r"^google/gemini-embedding-001$",
		r"^openai/text-embedding-3-small$",
		r"^qwen/qwen3-embedding",
	),
}
EMBEDDING_FALLBACK = (r"embedding", r"embed")
# Models that are not meant to be talked to, however their names match.
NOT_FOR_CHAT = re.compile(
	r"image|audio|tts|realtime|embedding|embed|vision-only|live|preview-tts", re.IGNORECASE
)


def providers() -> list[dict]:
	"""The services the setup card offers, limited to those this Flow can connect."""
	try:
		from flow_harness.model.discovery import MODEL_ENDPOINTS

		known = set(MODEL_ENDPOINTS)
	except Exception:
		known = {provider["name"] for provider in PROVIDERS}
	return [dict(provider) for provider in PROVIDERS if provider["name"] in known]


def status() -> dict:
	"""What the site has and what is still missing before Lumi can work."""
	from lms.lms.ai import setup

	embedding = frappe.db.get_single_value("Flow Knowledge Settings", "embedding_model")
	chat = None
	try:
		chat = setup.chat_model()
	except frappe.ValidationError:
		frappe.clear_last_message()
	chat_provider = frappe.db.get_value("Flow Model", chat, "provider") if chat else None
	embeds = {provider["name"]: provider["embeds"] for provider in PROVIDERS}
	return {
		"chat_model": chat,
		"chat_provider": chat_provider,
		"embedding_model": embedding,
		"ready": bool(chat and embedding),
		# The chat provider has no embedding models: search needs a key from one that has.
		"embedding_needs_other_key": bool(chat and not embedding and not embeds.get(chat_provider, True)),
	}


def connect(provider: str, api_key: str, embedding_only: bool = False) -> dict:
	"""Check and save the key with Flow, then pick and save the provider's chat model and
	embedding model. With `embedding_only`, a second key that brings search to a provider that
	has none of its own. Returns the status, or Flow's refusal of the key."""
	require_learning_admin()
	provider = (provider or "").strip().lower()
	if provider not in {p["name"] for p in providers()}:
		frappe.throw(_("Pick one of the listed providers."))
	from frappe.flow.api.setup import connect as flow_connect

	refused = flow_connect(provider, api_key)
	if not refused.get("ok"):
		return {"ok": False, "message": refused.get("message") or _("The key was not accepted.")}
	models = [model.removeprefix(f"{provider}/") for model in _provider_models(provider)]
	tried = []
	if not embedding_only and not status()["chat_model"]:
		tried.append(
			_add_first_that_works(
				provider,
				_ranked(models, CHAT_PREFERENCES.get(provider, ()), CHAT_FALLBACK, chat=True),
				for_chat=True,
			)
		)
	if not frappe.db.get_single_value("Flow Knowledge Settings", "embedding_model"):
		name = _add_first_that_works(
			provider,
			_ranked(models, EMBEDDING_PREFERENCES.get(provider, ()), EMBEDDING_FALLBACK),
			for_chat=False,
		)
		if name:
			_set_embedding(name)
		tried.append(name)
	return {"ok": True, **status()}


def _ranked(models: list[str], preferences: tuple, fallback: tuple, chat: bool = False) -> list[str]:
	"""The provider's models in the order worth trying: preferred patterns first, then fallbacks."""
	candidates = [m for m in models if not (chat and NOT_FOR_CHAT.search(m))] if chat else list(models)
	ranked: list[str] = []
	for pattern in (*preferences, *fallback):
		for model in candidates:
			if re.search(pattern, model, re.IGNORECASE) and model not in ranked:
				ranked.append(model)
	return ranked[:4]


def _add_first_that_works(provider: str, candidates: list[str], for_chat: bool) -> str | None:
	"""Flow saves a model only once it answers; try the next candidate when one does not."""
	for model in candidates:
		result = _add_model(provider, model, for_chat)
		if result.get("check", {}).get("ok") and result.get("name"):
			return result["name"]
	return None


def _set_embedding(model: str) -> None:
	settings = frappe.get_doc("Flow Knowledge Settings")
	settings.embedding_model = model
	settings.save()


# Flow's calls, one place each, so tests can stand in for them.


def _provider_models(provider: str) -> list[str]:
	from frappe.flow.doctype.flow_model.flow_model import get_provider_models

	return get_provider_models(provider)


def _add_model(provider: str, model: str, for_chat: bool) -> dict:
	from frappe.flow.api.setup import add_model

	return add_model(provider, model, for_chat=for_chat)
