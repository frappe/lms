"""Lumi, the tutor every learner meets, and the cast that role-plays draw from.

The names are invented and were checked against Frappe's staff list: a character must never share
a name with a real colleague. The frontend draws and voices each one by the same keys.
"""

from typing import Literal

TUTOR_NAME = "Lumi"

CAST = {
	"brannoc": {
		"name": "Brannoc",
		"personality": "Blunt and impatient. Wants results now and pushes back hard. Calms down when "
		"the other person stays steady and gives clear next steps.",
		"suits": "an angry customer, a demanding manager, an escalation",
	},
	"quilla": {
		"name": "Quilla",
		"personality": "Anxious and soft-spoken. Hesitant, doubts herself and goes quiet if rushed. "
		"Opens up when someone listens and reassures her.",
		"suits": "a new joiner, a colleague reporting a problem, a nervous user",
	},
	"fenwick": {
		"name": "Fenwick",
		"personality": "Sceptical and precise. Asks why and wants proof, catches vague answers, and "
		"respects facts, numbers and the exact policy.",
		"suits": "an auditor, a finance head, a careful buyer",
	},
	"odalie": {
		"name": "Odalie",
		"personality": "Warm and chatty. Friendly, drifts off-topic and overshares. Tests whether "
		"someone can stay kind and still get to the point.",
		"suits": "a friendly customer, a talkative colleague, an onboarding call",
	},
	"tavish": {
		"name": "Tavish",
		"personality": "Smooth and boundary-testing. Charming and confident, pushes for exceptions "
		"and shortcuts. Tests whether someone holds the line politely.",
		"suits": "a pushy vendor, someone asking for a discount or an exception",
	},
}

CastKey = Literal["brannoc", "quilla", "fenwick", "odalie", "tavish"]


def cast_guide() -> str:
	"""The cast as the plan drafter reads it."""
	return "\n".join(
		f"  - {key}: {member['name']}. {member['personality']} Suits {member['suits']}."
		for key, member in CAST.items()
	)
