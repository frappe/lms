"""One skill's dashboard: its numbers against last month, its funnel and its totals over time.

People move from enrolled to started to completed (every activity done). A skill with rules
(a minimum score, acknowledgement or sign-off) adds passed: completed and every rule met.
Without rules the two are the same, so only completed shows.

Shaped like the course dashboard, so an admin reads both the same way.
"""

from datetime import timedelta

import frappe
from frappe.utils import add_days, flt, get_datetime, getdate, now_datetime

WEEKS = 12


class SkillDashboard:
	def __init__(self, goal: str):
		self.goal = goal
		self.now = now_datetime()
		rules = frappe.db.get_value(
			"LMS Goal", goal, ["proof_mastery", "proof_acknowledgement", "proof_sign_off"], as_dict=True
		)
		self.has_rules = bool(rules and any(rules.values()))
		self.assignments = frappe.get_all(
			"LMS Goal Assignment",
			filters={"goal": goal, "is_preview": 0},
			fields=[
				"name",
				"member",
				"creation",
				"modified",
				"started_on",
				"ready_on",
				"progress",
				"score",
				"status",
			],
		)
		self.evidence = frappe.get_all(
			"LMS Goal Evidence",
			filters={"goal": goal, "assignment": ("in", [a.name for a in self.assignments] or [""])},
			fields=["assignment", "member", "modified"],
		)

	def data(self) -> dict:
		return {
			"cards": self.cards(),
			"funnel": self.funnel(),
			"activity": self.activity(),
			"has_rules": self.has_rules,
			"last_active": self.last_active(),
		}

	def cards(self) -> dict:
		month_ago = self.now - timedelta(days=30)
		return {
			"assigned": self._card(
				len(self.assignments),
				_change(
					self._assigned_between(month_ago, self.now),
					self._assigned_between(month_ago - timedelta(days=30), month_ago),
				),
				[self._assigned_between(start, end) for start, end in self._weeks()],
			),
			"active": self._card(
				self._active_between(self.now - timedelta(days=7), self.now),
				_change(
					self._active_between(self.now - timedelta(days=7), self.now),
					self._active_between(month_ago - timedelta(days=7), month_ago),
				),
				[self._active_between(start, end) for start, end in self._weeks()],
			),
			"ready_rate": self._card(
				self._ready_rate(self.now),
				_points(self._ready_rate(self.now), self._ready_rate(month_ago)),
				[self._ready_rate(end) for _, end in self._weeks()],
			),
			"mastery": self._card(
				self._mastery(self.now),
				_points(self._mastery(self.now), self._mastery(month_ago)),
				[self._mastery(end) for _, end in self._weeks()],
			),
		}

	def funnel(self) -> list[dict]:
		"""Each stage counts everyone who got at least that far."""
		stages = [
			("assigned", "Enrolled", lambda a: True),
			("started", "Started", lambda a: a.started_on or flt(a.progress) > 0),
			("completed", "Completed", _completed),
		]
		if self.has_rules:
			stages.append(("passed", "Passed", lambda a: a.status == "Ready"))
		return [
			{"key": key, "stage": frappe._(label), "students": sum(1 for a in self.assignments if reached(a))}
			for key, label, reached in stages
		]

	def activity(self) -> list[dict]:
		"""Running totals since the first enrollment: enrolled, completed and, with rules, passed.

		Weekly while the skill is young, monthly once it has run for more than half a year.
		"""
		if not self.assignments:
			return []
		first = min(get_datetime(a.creation) for a in self.assignments)
		monthly = (self.now - first).days > 182
		rows = []
		for start, end in _periods(first, self.now, monthly):
			row = {
				"date": str(getdate(start)),
				"enrolled": sum(1 for a in self.assignments if get_datetime(a.creation) < end),
				"completed": sum(1 for a in self.assignments if (at := _completed_at(a)) and at < end),
			}
			if self.has_rules:
				row["passed"] = sum(1 for a in self.assignments if (at := _ready_at(a)) and at < end)
			rows.append(row)
		return rows

	def last_active(self) -> dict[str, str]:
		"""When each assignment last moved: its latest evidence, else when it started."""
		latest = {}
		for e in self.evidence:
			latest[e.assignment] = max(latest.get(e.assignment, e.modified), e.modified)
		for a in self.assignments:
			if a.name not in latest and a.started_on:
				latest[a.name] = a.started_on
		return {name: str(when) for name, when in latest.items()}

	def _weeks(self) -> list[tuple]:
		monday = get_datetime(add_days(getdate(self.now), -getdate(self.now).weekday()))
		starts = [monday - timedelta(weeks=n) for n in range(WEEKS - 1, -1, -1)]
		return [(start, start + timedelta(weeks=1)) for start in starts]

	def _assigned_between(self, start, end) -> int:
		return sum(1 for a in self.assignments if start <= get_datetime(a.creation) < end)

	def _active_between(self, start, end) -> int:
		return len({e.member for e in self.evidence if start <= get_datetime(e.modified) < end})

	def _ready_rate(self, at) -> float | None:
		assigned = [a for a in self.assignments if get_datetime(a.creation) <= at]
		ready = [a for a in assigned if (when := _ready_at(a)) and when <= at]
		return round(100 * len(ready) / len(assigned)) if assigned else None

	def _mastery(self, at) -> float | None:
		"""The average score, as the people list shows it; a score counts from when it was last saved."""
		scores = [
			flt(a.score)
			for a in self.assignments
			if a.status != "Assigned" and a.score and get_datetime(a.modified) <= at
		]
		return round(sum(scores) / len(scores)) if scores else None

	@staticmethod
	def _card(value, delta, trend) -> dict:
		return {"value": value, "delta": delta, "trend": trend}


def _completed(assignment) -> bool:
	"""Every activity done. A ready row counts even when an admin marked it by hand."""
	return assignment.status == "Ready" or flt(assignment.progress) >= 100


def _completed_at(assignment):
	"""When someone completed. Nothing stores the moment, so the row's last save stands in."""
	if not _completed(assignment):
		return None
	return get_datetime(assignment.ready_on or assignment.modified)


def _periods(first, now, monthly: bool) -> list[tuple]:
	"""Back-to-back weeks (from Monday) or months (from the 1st), the first holding `first`."""
	first = getdate(first)
	start = get_datetime(first.replace(day=1) if monthly else add_days(first, -first.weekday()))
	periods = []
	while start <= now:
		if monthly:
			end = get_datetime((start.replace(day=28) + timedelta(days=4)).replace(day=1))
		else:
			end = start + timedelta(weeks=1)
		periods.append((start, end))
		start = end
	return periods


def _ready_at(assignment):
	"""When someone became ready. A row made ready by hand has no ready_on, so its last save stands in."""
	if assignment.status != "Ready":
		return None
	return get_datetime(assignment.ready_on or assignment.modified)


def _change(current: int, previous: int) -> float | None:
	"""Percent change, or None when there is nothing to compare against."""
	return round(100 * (current - previous) / previous) if previous else None


def _points(current: float | None, previous: float | None) -> float | None:
	"""Change in percentage points; None when either side has no reading yet."""
	return current - previous if current is not None and previous is not None else None
