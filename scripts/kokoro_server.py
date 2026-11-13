# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = [
#     "kokoro>=0.9",
#     "soundfile",
#     "faster-whisper>=1.2.1",
#     "av>=15.1,<17",
#     "en-core-web-sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl",
# ]
#
# [tool.uv.sources]
# torch = { index = "pytorch-cpu", marker = "sys_platform == 'linux'" }
#
# [[tool.uv.index]]
# name = "pytorch-cpu"
# url = "https://download.pytorch.org/whl/cpu"
# explicit = true
# ///
# av: 14's Linux wheels left PyPI, and faster-whisper 1.2.1 works with 15 and 16, which have them.
# en-core-web-sm: Kokoro's text front end needs spaCy's small English model. Left to itself,
# spaCy downloads it on first use with pip or uv, which a service under systemd has neither of.
# On Linux, torch comes from PyTorch's CPU index: the default build drags in 3 GB of CUDA
# libraries that a server without a GPU never uses.
"""Learning's voice server: Kokoro-82M speaks, Whisper listens. No API costs, no GPU.

Run it with uv, which keeps its dependencies out of the bench env:

    uv run apps/lms/scripts/kokoro_server.py

The first start downloads the models from Hugging Face (~550MB). Then point the site at
it in site_config.json: "lms_local_tts_url": "http://127.0.0.1:8765".

On a server of its own (see scripts/voice-server/README.md) set these in the environment:

    LMS_VOICE_TOKEN      shared secret; requests must carry "Authorization: Bearer <token>"
    LMS_VOICE_HOST       address to listen on, 127.0.0.1 by default (put Caddy in front)
    LMS_VOICE_PORT       8765 by default
    LMS_VOICE_MAX_MB     largest upload accepted, 25 by default (a 10 minute video piece is ~2.5)
    LMS_VOICE_WHISPER    Whisper model, small.en by default; medium.en hears better, slower
    LMS_VOICE_KEEP_LAST  1 keeps the last recording at /tmp/lms_last_turn.webm, for debugging

POST /tts with {"text": ..., "voice": "af_heart"} answers with a WAV.
POST /stt with recorded audio (any format ffmpeg reads, e.g. webm or mp3) answers {"text": ...}.
GET  /health answers {"ok": true, "whisper": true} once both models are loaded.
"""

import hmac
import io
import json
import os
import pathlib
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import soundfile
from kokoro import KPipeline

HOST = os.environ.get("LMS_VOICE_HOST", "127.0.0.1")
PORT = int(os.environ.get("LMS_VOICE_PORT", "8765"))
TOKEN = os.environ.get("LMS_VOICE_TOKEN", "")
MAX_BYTES = int(float(os.environ.get("LMS_VOICE_MAX_MB", "25")) * 1024 * 1024)
WHISPER_MODEL = os.environ.get("LMS_VOICE_WHISPER", "small.en")
KEEP_LAST = os.environ.get("LMS_VOICE_KEEP_LAST") == "1"

pipeline = KPipeline(lang_code="a")  # American English; British voices still work
# One model, many worker threads: generation holds the lock, sentence requests queue.
generate_lock = threading.Lock()

whisper = None
whisper_lock = threading.Lock()


def load_whisper() -> None:
	"""Loads (and first time, downloads) the transcriber, so the first turn is not minutes."""
	global whisper
	with whisper_lock:
		if whisper is None:
			from faster_whisper import WhisperModel

			# "small" holds up on accented English; int8 keeps CPU latency near realtime.
			# English only: the same speed as "small", and fewer misheard words for English speakers.
			whisper = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
			print("Whisper ready", flush=True)


def synthesize(text: str, voice: str, speed: float = 1.0) -> bytes:
	import numpy

	with generate_lock:
		segments = [audio for _, _, audio in pipeline(text, voice=voice, speed=speed)]
	audio = numpy.concatenate(segments)
	# Players fade in and eat the first instants, which makes the opening word sound
	# quiet; a breath of lead-in protects it. Peak normalization keeps every sentence
	# at the same loudness.
	peak = float(numpy.max(numpy.abs(audio))) if audio.size else 0.0
	if peak > 0:
		audio = audio * (0.9 / peak)
	audio = numpy.concatenate([numpy.zeros(int(0.08 * 24000), dtype=audio.dtype), audio])
	buffer = io.BytesIO()
	soundfile.write(buffer, audio, 24000, format="WAV")
	return buffer.getvalue()


def transcribe(data: bytes, hint: str = "") -> str:
	if KEEP_LAST:
		# The last turn stays on disk, so "it heard nothing" can be answered by listening.
		pathlib.Path("/tmp/lms_last_turn.webm").write_bytes(data)
	load_whisper()
	with whisper_lock:
		segments, _info = whisper.transcribe(
			io.BytesIO(data),
			language="en",
			vad_filter=True,
			# The session's own words (assembly point, fire warden, the character's name), so
			# Whisper expects them instead of hearing "possibly point".
			initial_prompt=hint or None,
			# Greedy decoding: a turn is seconds long, and beam search triples the wait.
			beam_size=1,
			condition_on_previous_text=False,
		)
		return " ".join(segment.text.strip() for segment in segments).strip()


class Handler(BaseHTTPRequestHandler):
	def do_GET(self):
		if self.path != "/health":
			self.send_error(404)
			return
		self.answer(json.dumps({"ok": True, "whisper": whisper is not None}).encode(), "application/json")

	def do_POST(self):
		try:
			if not self.authorised():
				self.send_error(401, "Missing or wrong token")
				return
			length = int(self.headers.get("Content-Length") or 0)
			if length <= 0:
				self.send_error(400, "Empty request")
				return
			if length > MAX_BYTES:
				self.send_error(413, f"Larger than {MAX_BYTES // (1024 * 1024)} MB")
				return
			body = self.rfile.read(length)
			if self.path == "/tts":
				payload = json.loads(body)
				self.answer(
					synthesize(
						payload["text"][:1000],
						payload.get("voice") or "af_heart",
						min(max(float(payload.get("speed") or 1.0), 0.7), 1.4),
					),
					"audio/wav",
				)
			elif self.path == "/stt":
				hint = urllib.parse.unquote(self.headers.get("X-Hint") or "")[:600]
				text = transcribe(body, hint)
				self.answer(json.dumps({"text": text}).encode(), "application/json")
			else:
				self.send_error(404)
		except Exception as error:  # noqa: BLE001 - one bad request must not kill the server
			self.send_error(500, str(error)[:200])

	def authorised(self) -> bool:
		"""Without a configured token anyone on the (local) interface may call; with one, the
		bearer must match. Compared in constant time."""
		if not TOKEN:
			return True
		sent = (self.headers.get("Authorization") or "").removeprefix("Bearer ").strip()
		return hmac.compare_digest(sent, TOKEN)

	def answer(self, payload: bytes, content_type: str) -> None:
		self.send_response(200)
		self.send_header("Content-Type", content_type)
		self.send_header("Content-Length", str(len(payload)))
		self.end_headers()
		self.wfile.write(payload)

	def log_message(self, format, *args):  # noqa: A002 - BaseHTTPRequestHandler's signature
		pass  # one line per sentence is just noise


if __name__ == "__main__":
	if HOST != "127.0.0.1" and not TOKEN:
		raise SystemExit("Set LMS_VOICE_TOKEN before listening on anything but 127.0.0.1.")
	threading.Thread(target=load_whisper, daemon=True).start()
	print(f"Kokoro speaking on http://{HOST}:{PORT}/tts", flush=True)
	ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
