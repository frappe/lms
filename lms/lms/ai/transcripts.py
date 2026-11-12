"""Video lessons as material: what a video says, as text, read once and kept so Lumi can teach from
a lesson that is only a video.

Two ways in, in this order:
1. Captions the owner or the platform already made: YouTube, Vimeo, Cloudflare Stream and Bunny.
2. Speech recognition on the audio, for a video uploaded to the site or streamed from Cloudflare
   or Bunny: ffmpeg pulls the audio and a Whisper service writes it down. Locally that is the
   voice sidecar (`lms_local_tts_url`); hosted, DeepInfra's Whisper (`deepinfra_api_key`).

YouTube's streams and Vimeo's are protected, so those two are captions only.
"""

import json
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import frappe
import requests
from frappe.utils import add_days, now_datetime

from lms.lms.utils import get_editorjs_blocks

TRANSCRIPT_DOCTYPE = "LMS Video Transcript"
# A video that could not be read is tried again after a week: captions get added, services
# come back.
RETRY_AFTER_DAYS = 7
PREFERRED_LANGUAGES = ("en", "en-US", "en-GB", "en-IN")
YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
CLOUDFLARE = re.compile(r"^https://(customer-[a-z0-9]+\.cloudflarestream\.com)/([a-f0-9]{32})\b")
BUNNY = re.compile(
	r"^https://(?:iframe\.mediadelivery\.net|video\.bunnycdn\.com|player\.mediadelivery\.net)/(?:play|embed)/([A-Za-z0-9]+)/([A-Za-z0-9-]+)"
)
BUNNY_HOST = re.compile(r"https://(vz-[a-z0-9-]+\.b-cdn\.net)")
VIDEO_FILE_TYPES = ("mp4", "webm", "mov", "m4v", "ogg", "ogv", "mkv")
# Caption tracks mark sounds in brackets, in the track's language: [Music], [संगीत].
NOISE = re.compile(r"\[[^\]]{1,40}\]")
# A mis-tagged auto caption is rewritten into English in pieces this long, in characters.
REWRITE_CHUNK = 6000
# Audio goes to the speech service in pieces of this many seconds.
SPEECH_CHUNK_SECONDS = 600
HTTP_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; FrappeLearning/1.0)"}
HTTP_TIMEOUT = 30


@dataclass(frozen=True)
class Video:
	provider: str  # youtube | vimeo | cloudflare | bunny | file
	id: str
	source: str = ""

	@property
	def key(self) -> str:
		return f"{self.provider}/{self.id}"


def lesson_videos(content: str | None, youtube: str | None) -> list[Video]:
	"""The videos a lesson plays, in order: its embed and upload blocks, then the old youtube field."""
	videos: list[Video] = []

	def add(video: Video | None) -> None:
		if video and video.key not in {v.key for v in videos}:
			videos.append(video)

	for block in get_editorjs_blocks(content):
		data = block.get("data") or {}
		if block.get("type") == "embed":
			add(embedded_video(data.get("service"), data.get("source") or data.get("embed")))
		elif block.get("type") == "upload" and (data.get("file_type") or "").lower() in VIDEO_FILE_TYPES:
			if data.get("file_url"):
				add(Video("file", data["file_url"], data["file_url"]))
	add(embedded_video("youtube", youtube))
	return videos


def embedded_video(service, source) -> Video | None:
	if not isinstance(source, str) or not source.strip():
		return None
	source = source.strip()
	if service == "youtube":
		video = youtube_id(source)
		return Video("youtube", video, source) if video else None
	if service == "vimeo":
		match = re.match(r"^(?:https?://)?(?:www\.)?vimeo\.com/(\d+)(?:/([A-Za-z0-9]+))?", source)
		if not match:
			match = re.match(r"^https://player\.vimeo\.com/video/(\d+)(?:\?h=([A-Za-z0-9]+))?", source)
		if match:
			return Video("vimeo", match.group(1) + (f":{match.group(2)}" if match.group(2) else ""), source)
	if service == "cloudflareStream":
		match = CLOUDFLARE.match(source)
		if match:
			return Video("cloudflare", f"{match.group(1)}/{match.group(2)}", source)
	if service == "bunnyStream":
		match = BUNNY.match(source)
		if match:
			return Video("bunny", f"{match.group(1)}/{match.group(2)}", source)
	return None


def youtube_id(value) -> str | None:
	"""A YouTube id from an id, a watch URL, a short URL or an embed URL."""
	if not isinstance(value, str) or not value.strip():
		return None
	value = value.strip()
	if YOUTUBE_ID.match(value):
		return value
	url = urlparse(value)
	host = (url.hostname or "").lower().removeprefix("www.").removeprefix("m.")
	candidate = None
	if host == "youtu.be":
		candidate = url.path.strip("/").split("/")[0]
	elif host in ("youtube.com", "youtube-nocookie.com"):
		if url.path == "/watch":
			candidate = (parse_qs(url.query).get("v") or [None])[0]
		else:
			parts = [part for part in url.path.split("/") if part]
			if len(parts) >= 2 and parts[0] in ("embed", "shorts", "live", "v"):
				candidate = parts[1]
	return candidate if candidate and YOUTUBE_ID.match(candidate) else None


def transcript(video: Video, hint: str = "") -> str | None:
	"""What the video says, or None when it could not be read. Read once and kept."""
	row = frappe.db.get_value(
		TRANSCRIPT_DOCTYPE,
		video.key,
		["status", "text", "fetched_on", "is_generated", "language", "source_language"],
		as_dict=True,
	)
	if row and row.status == "Ready":
		return _rewritten_later(video, row) or row.text
	if row and row.fetched_on and row.fetched_on > add_days(now_datetime(), -RETRY_AFTER_DAYS):
		return None
	reading = _read(video, hint)
	_remember(video, reading)
	return reading.text


@dataclass
class Reading:
	text: str | None = None
	method: str | None = None  # Captions | Speech
	language: str | None = None
	source_language: str | None = None
	generated: bool = False
	error: str | None = None


def _read(video: Video, hint: str) -> Reading:
	reading = _captions(video)
	if reading.text:
		if reading.generated and not _is_english(reading.language):
			# YouTube guessed the language from the speaker's accent: English speech comes back
			# written in another script. The chat model writes it as the English it is.
			rewritten = _english(reading.text)
			if rewritten:
				reading.text, reading.source_language, reading.language = rewritten, reading.language, "en"
		return reading
	media = _media_url(video)
	if not media:
		return reading if reading.error else Reading(error=_no_way_in(video))
	return _speech(media, hint)


def _rewritten_later(video: Video, row) -> str | None:
	"""A mis-tagged caption kept in its wrong script because the model was down when it was read:
	try the English rewrite again now, and keep it once it works."""
	if not (row.is_generated and not _is_english(row.language) and not row.source_language):
		return None
	rewritten = _english(row.text)
	if rewritten:
		frappe.db.set_value(
			TRANSCRIPT_DOCTYPE,
			video.key,
			{"text": rewritten, "source_language": row.language, "language": "en"},
			update_modified=False,
		)
	return rewritten


def _no_way_in(video: Video) -> str:
	if video.provider == "youtube":
		return "This video has no captions."
	if video.provider == "vimeo":
		return "This video has no captions, and Vimeo does not let us listen to it."
	return "This video could not be reached."


# Captions


def _captions(video: Video) -> Reading:
	try:
		if video.provider == "youtube":
			return _youtube_captions(video.id)
		if video.provider == "vimeo":
			return _vimeo_captions(video)
		if video.provider == "cloudflare":
			return _vtt_by_language(f"https://{video.id}/captions/{{lang}}")
		if video.provider == "bunny":
			host = _bunny_host(video)
			return (
				_vtt_by_language(f"https://{host}/{video.id.split('/')[1]}/captions/{{lang}}.vtt")
				if host
				else Reading()
			)
	except Exception as e:
		return Reading(error=str(e)[:500])
	return Reading()


def _youtube_captions(video_id: str) -> Reading:
	"""A person's English first, then generated English, then any track there is."""
	try:
		from youtube_transcript_api import YouTubeTranscriptApi
	except ImportError:
		return Reading(error="The youtube-transcript-api package is not installed.")
	available = YouTubeTranscriptApi().list(video_id)
	chosen = None
	for finder in (available.find_manually_created_transcript, available.find_generated_transcript):
		try:
			chosen = finder(list(PREFERRED_LANGUAGES))
			break
		except Exception:
			continue
	if chosen is None:
		chosen = next(iter(available), None)
	if chosen is None:
		return Reading(error="This video has no captions.")
	fetched = chosen.fetch()
	text = _clean(" ".join(snippet.text for snippet in fetched.snippets))
	if not text:
		return Reading(error="This video's captions are empty.")
	return Reading(
		text=text, method="Captions", language=chosen.language_code, generated=bool(chosen.is_generated)
	)


def _vimeo_captions(video: Video) -> Reading:
	number, _, hash_ = video.id.partition(":")
	url = f"https://player.vimeo.com/video/{number}/config" + (f"?h={hash_}" if hash_ else "")
	response = requests.get(url, headers=HTTP_HEADERS, timeout=HTTP_TIMEOUT)
	if not response.ok:
		return Reading(error=f"Vimeo answered {response.status_code}.")
	tracks = (response.json().get("request") or {}).get("text_tracks") or []
	if not tracks:
		return Reading()
	track = next(
		(t for t in tracks if (t.get("lang") or "").lower() in [l.lower() for l in PREFERRED_LANGUAGES]),
		tracks[0],
	)
	text = _fetch_vtt(track.get("url") or "")
	if not text:
		return Reading(error="This video's captions could not be read.")
	return Reading(text=text, method="Captions", language=track.get("lang"), generated=False)


def _vtt_by_language(template: str) -> Reading:
	"""Captions served at a known address per language, with no list to ask: try English first."""
	for lang in PREFERRED_LANGUAGES:
		text = _fetch_vtt(template.format(lang=lang))
		if text:
			return Reading(text=text, method="Captions", language=lang, generated=False)
	return Reading()


def _fetch_vtt(url: str) -> str | None:
	if not url:
		return None
	if url.startswith("//"):
		url = "https:" + url
	response = requests.get(url, headers=HTTP_HEADERS, timeout=HTTP_TIMEOUT)
	if not response.ok or "WEBVTT" not in response.text[:200]:
		return None
	return vtt_text(response.text)


def vtt_text(vtt: str) -> str:
	"""The words of a WebVTT file: no header, timings, cue names, tags or repeated rolling lines."""
	lines = []
	for raw in vtt.splitlines():
		line = re.sub(r"<[^>]+>", "", raw).strip()
		if (
			not line
			or line.startswith(("WEBVTT", "NOTE", "STYLE", "REGION", "Kind:", "Language:"))
			or "-->" in line
			or re.fullmatch(r"\d+", line)
		):
			continue
		if lines and (line == lines[-1] or lines[-1].endswith(line)):
			continue
		lines.append(line)
	return _clean(" ".join(lines))


def _bunny_host(video: Video) -> str | None:
	"""Bunny's files live on a pull zone the embed page names; the embed address does not."""
	library, video_id = video.id.split("/", 1)
	response = requests.get(
		f"https://iframe.mediadelivery.net/embed/{library}/{video_id}",
		headers=HTTP_HEADERS,
		timeout=HTTP_TIMEOUT,
	)
	match = BUNNY_HOST.search(response.text) if response.ok else None
	return match.group(1) if match else None


# Speech


def _media_url(video: Video) -> str | None:
	"""Where ffmpeg can listen to the video, when the platform allows it."""
	if video.provider == "file":
		try:
			return frappe.get_doc("File", {"file_url": video.id}).get_full_path()
		except frappe.DoesNotExistError:
			frappe.clear_last_message()
			return None
	if video.provider == "cloudflare":
		return f"https://{video.id}/manifest/video.m3u8"
	if video.provider == "bunny":
		host = _bunny_host(video)
		return f"https://{host}/{video.id.split('/')[1]}/playlist.m3u8" if host else None
	return None


def speech_service() -> str | None:
	"""Which Whisper writes speech down on this site: the local sidecar, DeepInfra, or nothing."""
	if frappe.conf.get("lms_local_tts_url"):
		return "local"
	if frappe.conf.get("deepinfra_api_key"):
		return "deepinfra"
	return None


def _speech(media: str, hint: str) -> Reading:
	service = speech_service()
	if not service:
		return Reading(
			error="No speech recognition is set up on this site, so videos without captions stay silent."
		)
	if not shutil.which("ffmpeg"):
		return Reading(error="ffmpeg is not installed on this server, so videos cannot be listened to.")
	with tempfile.TemporaryDirectory(prefix="lms-video-") as folder:
		try:
			chunks = _audio_chunks(media, Path(folder))
		except subprocess.CalledProcessError as e:
			return Reading(
				error=f"The audio could not be read: {(e.stderr or b'').decode(errors='ignore')[-300:]}"
			)
		if not chunks:
			return Reading(error="This video has no sound.")
		parts = []
		for chunk in chunks:
			try:
				parts.append(transcribe_audio(service, chunk.read_bytes(), hint))
			except Exception as e:
				return Reading(error=f"Speech recognition failed: {str(e)[:300]}")
	text = _clean(" ".join(parts))
	if not text:
		return Reading(error="Nothing was said in this video that could be written down.")
	return Reading(text=text, method="Speech", language="en", generated=True)


def _audio_chunks(media: str, folder: Path) -> list[Path]:
	"""The video's sound as small mono MP3 pieces, each one request to the speech service."""
	subprocess.run(
		[
			"ffmpeg",
			"-nostdin",
			"-loglevel",
			"error",
			"-y",
			"-i",
			media,
			"-vn",
			"-ac",
			"1",
			"-ar",
			"16000",
			"-c:a",
			"libmp3lame",
			"-b:a",
			"32k",
			"-f",
			"segment",
			"-segment_time",
			str(SPEECH_CHUNK_SECONDS),
			"-reset_timestamps",
			"1",
			str(folder / "part-%03d.mp3"),
		],
		check=True,
		capture_output=True,
		timeout=60 * 60,
	)
	return sorted(folder.glob("part-*.mp3"))


def transcribe_audio(service: str, audio: bytes, hint: str, filename: str = "audio.mp3") -> str:
	"""One recording as text, from the local sidecar or DeepInfra's Whisper. Raises on failure."""
	from urllib.parse import quote

	if service == "local":
		base = frappe.conf.get("lms_local_tts_url").rstrip("/")
		response = requests.post(
			f"{base}/stt", data=audio, headers={"X-Hint": quote(hint[:600])}, timeout=60 * 30
		)
		response.raise_for_status()
		return response.json().get("text", "")
	response = requests.post(
		"https://api.deepinfra.com/v1/openai/audio/transcriptions",
		headers={"Authorization": f"bearer {frappe.conf.get('deepinfra_api_key')}"},
		files={"file": (filename, audio)},
		data={"model": "openai/whisper-large-v3-turbo", "prompt": hint[:600]},
		timeout=60 * 10,
	)
	response.raise_for_status()
	return response.json().get("text", "")


# Clean-up


def _is_english(language: str | None) -> bool:
	return (language or "").lower().startswith("en")


def _clean(text: str) -> str:
	text = NOISE.sub(" ", text.replace("\n", " "))
	return re.sub(r"\s+", " ", text).strip()


def _english(text: str) -> str | None:
	"""English speech that YouTube captioned in the wrong language, written as English. None when
	the site has no chat model or the model fails: the original is still better than nothing."""
	try:
		import litellm
		from frappe.flow.lib.model import model_config

		from lms.lms.ai.setup import chat_model

		config = model_config(chat_model(), check_permission=False)
	except Exception:
		frappe.clear_last_message()
		return None
	kwargs = {
		**config.pop("model_params", {}),
		"model": config["model"],
		"api_key": config.get("api_key"),
		"timeout": 120,
	}
	if config.get("api_base"):
		kwargs["api_base"] = config["api_base"]
	pieces = []
	for start in range(0, len(text), REWRITE_CHUNK):
		try:
			reply = litellm.completion(
				**kwargs,
				messages=[
					{"role": "system", "content": REWRITE_PROMPT},
					{"role": "user", "content": text[start : start + REWRITE_CHUNK]},
				],
			)
			pieces.append((reply.choices[0].message.content or "").strip())
		except Exception:
			frappe.log_error(title="Video transcript rewrite failed")
			return None
	result = " ".join(piece for piece in pieces if piece)
	return result or None


REWRITE_PROMPT = (
	"You receive automatic captions of a video. The speaker talks in English, but the captions "
	"were made for another language, so the English words are written in that language's script "
	"or mixed with mishearings. Write out what the speaker says, in plain English, as faithfully as "
	"you can. Keep product names, numbers and terms as spoken. Do not summarise, add, comment or "
	"translate anything that is in another language: write only the English speech."
)


def _remember(video: Video, reading: Reading) -> None:
	values = {
		"provider": video.provider,
		"source": video.source,
		"status": "Ready" if reading.text else "Unavailable",
		"method": reading.method,
		"language": reading.language,
		"source_language": reading.source_language,
		"is_generated": int(reading.generated),
		"fetched_on": now_datetime(),
		"text": reading.text,
		"error": reading.error,
	}
	if frappe.db.exists(TRANSCRIPT_DOCTYPE, video.key):
		frappe.db.set_value(TRANSCRIPT_DOCTYPE, video.key, values, update_modified=False)
	else:
		frappe.get_doc({"doctype": TRANSCRIPT_DOCTYPE, "video_id": video.key, **values}).insert(
			ignore_permissions=True
		)
