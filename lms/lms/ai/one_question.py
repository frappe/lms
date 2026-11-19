"""One question per turn, checked in code.

Lumi and the role-play cast are told to ask one thing at a time, and the fast model still asks
two now and then: two questions in a row, a second message after a tool, or two asks joined with
", and" in one sentence. The page holds a turn's questions back until the turn ends, then asks for
it here: the turn keeps only its first ask, and the model is told on the next message what the
learner actually saw. The edit is plain text, so it is instant and always holds; a model asked to
rewrite was slower than the reply itself and sometimes answered in character instead.
"""

import json
import re

import frappe

# A second ask joined to the first inside one question: "..., and what is the reference?"
JOINED_ASK = re.compile(
	r",\s*and\s+(what|which|who|whom|whose|where|when|why|how|do|does|did|can|could|would|will|is|"
	r"are|was|were|have|has|should)\b",
	re.I,
)
# The tutor saying what it is about to do with its own tools ("I'll confirm that one.") is noise
# to the learner: the page shows their progress. Prompts and tool replies alone did not stop it.
NARRATION = re.compile(
	r"^(?:\w+,\s*(?:and\s+)?)?(?:I['’]?ll|I will|let me|I['’]?m going to|I am going to)\s+"
	r"(?:now\s+)?(?:confirm|tick|mark)\b",
	re.I,
)
# Longer than this, a sentence is teaching something, whatever it starts with.
NARRATION_WORDS = 8
# What the learner saw stays known for this long, for the next message to carry.
SEEN_FOR = 24 * 60 * 60


def check_turn(session_name: str) -> dict[str, str]:
	"""The replies of the session's latest turn that must change, as {original: shown}."""
	texts = _latest_turn(session_name)
	changed = {}
	asked = False
	for text in texts:
		plain = without_narration(text)
		shown = _without_questions(plain) if asked else one_ask(plain)
		asked = asked or "?" in shown
		if shown != text:
			changed[text] = shown
	if changed:
		seen = " ".join(changed.get(text, text) for text in texts if changed.get(text, text))
		frappe.cache.set_value(_seen_key(session_name), seen, expires_in_sec=SEEN_FOR)
	return changed


def with_what_they_saw(session_name: str, message: str) -> str:
	"""The learner's next message, with a note on what they saw of a reply that was shortened."""
	from lms.lms.ai.goals import SYSTEM_NOTE

	seen = frappe.cache.get_value(_seen_key(session_name))
	if not seen:
		return message
	frappe.cache.delete_value(_seen_key(session_name))
	return (
		message
		+ SYSTEM_NOTE
		+ f"Your last reply reached the learner shortened to one question: {json.dumps(seen)} They "
		"never saw anything else you asked, so do not expect an answer to it."
	)


def one_ask(text: str) -> str:
	"""The reply up to the end of its first question, with any second ask joined to it cut off."""
	end = (text or "").find("?")
	if end < 0:
		return text
	start = max(text.rfind(mark, 0, end) for mark in (".", "!", "\n")) + 1
	question = text[start : end + 1]
	joined = JOINED_ASK.search(question)
	if not joined and "?" not in text[end + 1 :]:
		return text
	if joined:
		question = question[: joined.start()].rstrip(" ,;") + "?"
	return (text[:start] + question).strip()


def without_narration(text: str) -> str:
	"""The reply without sentences that only announce a tool call, such as "I'll tick that off."."""
	sentences = re.findall(r"[^.!?]+[.!?]*", text or "")
	kept = [s.strip() for s in sentences if not _narrates(s.strip())]
	return text if len(kept) == len(sentences) else " ".join(kept).strip()


def _narrates(sentence: str) -> bool:
	"""A short statement, never a question, that only says what the tutor is about to tick."""
	return (
		bool(NARRATION.search(sentence))
		and not sentence.endswith("?")
		and len(sentence.split()) <= NARRATION_WORDS
	)


def _without_questions(text: str) -> str:
	"""A later reply in a turn that already asked: its questions go."""
	sentences = re.findall(r"[^.!?]+[.!?]*", text or "")
	return " ".join(s.strip() for s in sentences if not s.strip().endswith("?")).strip()


def _latest_turn(session_name: str) -> list[str]:
	"""The assistant's replies since the learner's last message, in order."""
	from frappe.flow.lib.session import sync_with_retry

	sync_with_retry(frappe.get_doc("Flow Session", session_name))
	rows = frappe.get_all(
		"Flow Session Message",
		filters={"parent": session_name, "role": ("in", ("user", "assistant"))},
		fields=["role", "content"],
		order_by="idx asc",
	)
	turn: list[str] = []
	for row in rows:
		if row.role == "user":
			turn = []
		elif (row.content or "").strip():
			turn.append(row.content.strip())
	return turn


def _seen_key(session_name: str) -> str:
	return f"lms:one-question-seen:{session_name}"
