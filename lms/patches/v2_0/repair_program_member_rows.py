import frappe
from frappe import _

# Self-enrolment saved its rows under parentfield "members" from 9d3b6e055
# (2025-08-19) onward, so no stray row can be older than that.
CUTOFF = "2025-08-19"
# Each affected program is rewritten row by row. Past this, migrate would hold
# the table for minutes, so the operator runs repair_all outside migrate instead.
MAX_ROWS = 10_000
PARENTTYPE = "LMS Program"
TABLE_FIELD = "program_members"


def execute():
	stray = get_stray_rows(limit=MAX_ROWS + 1)
	if len(stray) > MAX_ROWS:
		frappe.throw(
			_(
				"More than {0} LMS Program Member rows need repair. Run bench --site {1} execute lms.patches.v2_0.repair_program_member_rows.repair_all, then migrate again."
			).format(MAX_ROWS, frappe.local.site)
		)
	repair(stray)


def repair_all():
	repair(get_stray_rows())


def get_stray_rows(limit: int | None = None):
	return frappe.get_all(
		"LMS Program Member",
		filters={"creation": [">=", CUTOFF]},
		or_filters={"parenttype": ["!=", PARENTTYPE], "parentfield": ["!=", TABLE_FIELD]},
		fields=["name", "parent"],
		limit=limit,
	)


def repair(stray):
	if not stray:
		return

	parents = {row.parent for row in stray}
	programs = set(frappe.get_all(PARENTTYPE, filters={"name": ["in", list(parents)]}, pluck="name"))
	ghosts = [row.name for row in stray if row.parent not in programs]
	if ghosts:
		frappe.db.delete("LMS Program Member", {"name": ["in", ghosts]})

	for program in sorted(programs):
		repair_program(program)


def repair_program(program: str):
	rows = frappe.get_all(
		"LMS Program Member",
		filters={"parent": program},
		fields=["name", "member", "parenttype", "parentfield", "idx", "creation"],
	)
	oldest = {}
	for row in sorted(rows, key=lambda row: (row.creation, row.name)):
		oldest.setdefault(row.member, row)

	duplicates = [row.name for row in rows if oldest[row.member].name != row.name]
	if duplicates:
		frappe.db.delete("LMS Program Member", {"name": ["in", duplicates]})

	members = sorted(oldest.values(), key=lambda row: (is_stray(row), row.idx, row.creation, row.name))
	for idx, row in enumerate(members, start=1):
		if is_stray(row) or row.idx != idx:
			frappe.db.set_value(
				"LMS Program Member",
				row.name,
				{"parenttype": PARENTTYPE, "parentfield": TABLE_FIELD, "idx": idx},
				update_modified=False,
			)

	if frappe.db.get_value(PARENTTYPE, program, "member_count") != len(members):
		frappe.db.set_value(PARENTTYPE, program, "member_count", len(members), update_modified=False)


def is_stray(row) -> bool:
	return (row.parenttype, row.parentfield) != (PARENTTYPE, TABLE_FIELD)
