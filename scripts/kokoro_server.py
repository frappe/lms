# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["kokoro>=0.9", "soundfile", "faster-whisper", "av<15"]
# ///
# av is pinned: 15 dropped the open() arguments faster-whisper still passes, and the
# python ceiling keeps us where av 14 ships wheels.
"""Learning's local voice sidecar: Kokoro-82M speaks, Whisper listens. No API costs.

Run it with uv, which keeps its dependencies out of the bench env:

    uv run apps/lms/scripts/kokoro_server.py

The first start downloads the models from Hugging Face (~550MB). Then point the site at
it in site_config.json: "lms_local_tts_url": "http://127.0.0.1:8765".

POST /tts with {"text": ..., "voice": "af_heart"} answers with a WAV.
POST /stt with recorded audio (any format ffmpeg reads, e.g. webm) answers {"text": ...}.
"""

import io
import json
import pathlib
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import soundfile
from kokoro import KPipeline

PORT = 8765

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
			whisper = WhisperModel("small.en", device="cpu", compute_type="int8")
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
	def do_POST(self):
		try:
			body = self.rfile.read(int(self.headers["Content-Length"]))
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

	def answer(self, payload: bytes, content_type: str) -> None:
		self.send_response(200)
		self.send_header("Content-Type", content_type)
		self.send_header("Content-Length", str(len(payload)))
		self.end_headers()
		self.wfile.write(payload)

	def log_message(self, format, *args):  # noqa: A002 - BaseHTTPRequestHandler's signature
		pass  # one line per sentence is just noise


if __name__ == "__main__":
	threading.Thread(target=load_whisper, daemon=True).start()
	print(f"Kokoro speaking on http://127.0.0.1:{PORT}/tts", flush=True)
	ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
