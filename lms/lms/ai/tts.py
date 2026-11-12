"""Speech for Lumi and the cast, from a hosted TTS provider.

The browser's own speechSynthesis stays as the frontend's fallback; this module only
answers when a provider key is in site_config. Two providers, so voices can be compared
on real session text:

- local: Kokoro-82M served by scripts/kokoro_server.py, `lms_local_tts_url`, with no API cost
- kokoro: Kokoro-82M on DeepInfra (OpenAI-compatible audio endpoint), `deepinfra_api_key`
- sarvam: Sarvam Bulbul, Indian-accent voices, `sarvam_api_key`

`lms_tts_provider` in site_config picks the default; the request may name another.
"""

import base64
import hashlib

import frappe
import requests
from frappe import _

# One voice per character and provider, chosen to keep the cast apart by ear.
KOKORO_VOICES = {
	"lumi": "af_heart",
	"quilla": "af_bella",
	"odalie": "af_sky",
	"brannoc": "am_fenrir",
	"fenwick": "bm_george",
	"tavish": "am_puck",
}

# Kokoro has no emotion control, but pace carries energy: the tutor leans bright,
# the sterner cast members sit back.
KOKORO_SPEEDS = {
	"lumi": 1.08,
	"quilla": 1.0,
	"odalie": 1.12,
	"brannoc": 0.96,
	"fenwick": 0.94,
	"tavish": 1.05,
}

VOICES = {
	"local": KOKORO_VOICES,
	"kokoro": KOKORO_VOICES,
	"sarvam": {
		"lumi": "anushka",
		"quilla": "manisha",
		"odalie": "arya",
		"brannoc": "abhilash",
		"fenwick": "hitesh",
		"tavish": "karun",
	},
}

MAX_CHARS = 1000
CACHE_TTL = 24 * 60 * 60


def providers() -> list[str]:
	"""The providers this site holds a key for, default first."""
	found = [name for name in VOICES if _api_key(name)]
	default = frappe.conf.get("lms_tts_provider")
	if default in found:
		found.remove(default)
		found.insert(0, default)
	return found


def synthesize(text: str, character: str, provider: str | None = None) -> tuple[bytes, str]:
	"""Audio for one short piece of text, as (bytes, mimetype). Cached by content."""
	configured = providers()
	if not configured:
		frappe.throw(_("No speech provider is configured on this site."), frappe.ValidationError)
	if provider and provider not in configured:
		frappe.throw(_("Speech provider {0} is not configured.").format(provider), frappe.ValidationError)
	provider = provider or configured[0]

	text = (text or "").strip()
	if not text:
		frappe.throw(_("Nothing to say."), frappe.ValidationError)
	if len(text) > MAX_CHARS:
		text = text[:MAX_CHARS]

	voice = VOICES[provider].get(character) or VOICES[provider]["lumi"]
	speed = KOKORO_SPEEDS.get(character, 1.0) if provider in ("local", "kokoro") else 1.0
	key = f"lms_tts:{provider}:{voice}:{speed}:{hashlib.sha256(text.encode()).hexdigest()}"
	cached = frappe.cache.get_value(key)
	if cached:
		return base64.b64decode(cached["audio"]), cached["mimetype"]

	audio, mimetype = _fetch(provider, text, voice, speed)
	frappe.cache.set_value(
		key, {"audio": base64.b64encode(audio).decode(), "mimetype": mimetype}, expires_in_sec=CACHE_TTL
	)
	return audio, mimetype


def _fetch(provider: str, text: str, voice: str, speed: float) -> tuple[bytes, str]:
	if provider == "local":
		return _local(text, voice, speed)
	if provider == "kokoro":
		return _kokoro(text, voice, speed)
	return _sarvam(text, voice)


def _local(text: str, voice: str, speed: float) -> tuple[bytes, str]:
	response = requests.post(
		f"{_api_key('local')}/tts",
		json={"text": text, "voice": voice, "speed": speed},
		timeout=60,
	)
	_raise_for_provider(response, "Local Kokoro")
	return response.content, "audio/wav"


def _kokoro(text: str, voice: str, speed: float) -> tuple[bytes, str]:
	response = requests.post(
		"https://api.deepinfra.com/v1/openai/audio/speech",
		headers={"Authorization": f"Bearer {_api_key('kokoro')}"},
		json={
			"model": "hexgrad/Kokoro-82M",
			"input": text,
			"voice": voice,
			"speed": speed,
			"response_format": "mp3",
		},
		timeout=30,
	)
	_raise_for_provider(response, "DeepInfra")
	return response.content, "audio/mpeg"


def _sarvam(text: str, voice: str) -> tuple[bytes, str]:
	response = requests.post(
		"https://api.sarvam.ai/text-to-speech",
		headers={"api-subscription-key": _api_key("sarvam")},
		json={
			"text": text,
			"target_language_code": "en-IN",
			"speaker": voice,
			"model": "bulbul:v2",
		},
		timeout=30,
	)
	_raise_for_provider(response, "Sarvam")
	audios = response.json().get("audios") or []
	if not audios:
		frappe.throw(_("The speech provider sent no audio."))
	return base64.b64decode(audios[0]), "audio/wav"


def _api_key(provider: str) -> str | None:
	"""The config that turns a provider on: a key, or the local server's URL."""
	setting = {
		"local": "lms_local_tts_url",
		"kokoro": "deepinfra_api_key",
		"sarvam": "sarvam_api_key",
	}[provider]
	value = frappe.conf.get(setting)
	return value.rstrip("/") if provider == "local" and value else value


def _raise_for_provider(response: requests.Response, name: str) -> None:
	if response.ok:
		return
	frappe.log_error(f"{name} TTS failed: {response.status_code}", response.text[:1000])
	frappe.throw(_("The speech provider could not read this aloud. Try again."))
