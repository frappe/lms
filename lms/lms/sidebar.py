import frappe
from frappe import _
from frappe.utils import cint, validate_url

# Home is the SPA's landing route; switching it off leaves a signed-in user with
# no way back. The form disables that switch and validate() is the boundary.
LOCKED_VISIBLE = frozenset({"home"})

# The seven Check fields on LMS Settings that gated a link before rows existed,
# in the order get_sidebar_settings has always emitted them. Each fieldname is
# also the name1 of the row that replaced it, which is what lets the patch line
# up without a lookup table.
LEGACY_VISIBILITY_FIELDS = (
	"courses",
	"batches",
	"certifications",
	"jobs",
	"statistics",
	"notifications",
	"programming_exercises",
)

# Everything a row owns, and the only fields copied when the table is rebuilt.
# Child row names are hashes nothing references, so rebuilding is safe; copying
# `name` would not be, since frappe reads it as a rename.
ROW_FIELDS = (
	"name1",
	"is_standard",
	"item_type",
	"hidden",
	"web_page",
	"route",
	"title",
	"url",
	"open_in_new_window",
	"icon",
)


def standard_items() -> list[dict]:
	return list(frappe.get_hooks("standard_sidebar_items"))


def standard_names() -> set[str]:
	return {item["name1"] for item in standard_items()}


def unique_name(base: str, taken: set[str]) -> str:
	base = frappe.scrub(base or "item") or "item"
	if base not in taken:
		return base
	suffix = 2
	while f"{base}_{suffix}" in taken:
		suffix += 1
	return f"{base}_{suffix}"


def seed_sidebar_items() -> None:
	"""Give every site the thirteen built-in rows, in hook order, ahead of
	whatever web pages it already has.

	Bounded by the catalogue: thirteen appends and one save on a Single. It
	never scans a table, so a date cutoff would bound nothing.

	Idempotent by name1 — a row already present is left exactly as the site
	left it, because a row carries admin state and this is not the only thing
	that will ever have written to it.
	"""
	settings = frappe.get_single("LMS Settings")
	existing = [{field: row.get(field) for field in ROW_FIELDS} for row in settings.sidebar_items]
	present = {row["name1"] for row in existing if row["name1"]}
	# Reserved separately from what is present. A web page titled "Courses" scrubs
	# to the built-in's own id, and stamping it there would make the built-in look
	# seeded and drop that row from the sidebar for good.
	taken = present | standard_names()

	# Web-page rows predate every field added for this feature.
	stamped = False
	for row in existing:
		if not row["item_type"]:
			row["item_type"] = "Web Page"
			stamped = True
		if not row["name1"]:
			row["name1"] = unique_name(row["web_page"], taken)
			taken.add(row["name1"])
			present.add(row["name1"])
			stamped = True

	missing = [item for item in standard_items() if item["name1"] not in present]
	if not missing and not stamped:
		return

	seeded = []
	for item in missing:
		row = dict(item)
		field = row["name1"] if row["name1"] in LEGACY_VISIBILITY_FIELDS else None
		row["hidden"] = 0 if (field is None or cint(settings.get(field))) else 1
		seeded.append(row)

	# New built-ins join the existing ones rather than jumping the queue, and
	# nothing else moves: a moderator's arrangement is theirs. The insertion
	# point is after the last Built-in row, so a fourteenth item added to the
	# hook later lands beside the thirteen instead of in front of them.
	cut = 0
	for index, row in enumerate(existing):
		if row["item_type"] == "Built-in":
			cut = index + 1

	# The built-ins alone. The web pages a site already had keep their place
	# after them; the sidebar folds them into "More" at render time, the way it
	# always has, so the seeder adds no row for that.
	settings.set("sidebar_items", [])
	for row in existing[:cut] + seeded + existing[cut:]:
		settings.append("sidebar_items", row)

	# nosemgrep: lms-unjustified-ignore-permissions - install/migrate seeding, which runs as Administrator with no user to authorise
	settings.flags.ignore_permissions = True
	# The seeder writes only rows it constructed and needs none of the other
	# validators LMSSettings.validate() runs — validate_google_settings and
	# validate_lesson_dwell_time can throw on state this patch never touches,
	# which would abort bench migrate for that site. validate_sidebar_items
	# itself is also unneeded: the seeder never deletes a row and already
	# assigns name1 and idx itself.
	settings.flags.ignore_validate = True
	settings.save()


def validate_sidebar_items(settings) -> None:
	if settings.has_value_changed("sidebar_items"):
		renumber_sidebar_items(settings)
	fill_in_missing_ids(settings)
	do_not_allow_to_delete_standard_sidebar_items(settings)
	validate_sidebar_item_targets(settings)


def renumber_sidebar_items(settings) -> None:
	"""Reordering assigns a new position in the python list, not a new idx on
	the row; without this, db_update() below writes each row back at the idx
	it already had and the reorder is silently lost on reload."""
	for position, row in enumerate(settings.sidebar_items, 1):
		row.idx = position


def fill_in_missing_ids(settings) -> None:
	"""A row added from the desk carries no id. Give it one from what it points
	at, so every row is addressable and the uniqueness check below has something
	to compare."""
	taken = {row.name1 for row in settings.sidebar_items if row.name1}
	for row in settings.sidebar_items:
		if row.name1:
			continue
		row.name1 = unique_name(row.web_page or row.title or row.item_type, taken)
		taken.add(row.name1)


def do_not_allow_to_delete_standard_sidebar_items(settings) -> None:
	"""CRM's algorithm, from fcrm_settings.do_not_allow_to_delete_if_standard:
	diff the name1s of standard rows across the save and refuse if any went.
	Reorder, hide and edit do not trip it; deletion does."""
	if settings.is_new() or not settings.has_value_changed("sidebar_items"):
		return

	before = settings.get_doc_before_save()
	if not before:
		return

	old = {row.name1 for row in before.get("sidebar_items") if row.is_standard}
	new = {row.name1 for row in settings.sidebar_items if row.is_standard}
	deleted = (old - new) & standard_names()
	if deleted:
		frappe.throw(
			_("Cannot delete the built-in sidebar links {0}. Switch them off instead.").format(
				frappe.bold(", ".join(sorted(deleted)))
			)
		)


def validate_sidebar_item_targets(settings) -> None:
	known = standard_names()
	seen = set()

	for row in settings.sidebar_items:
		if row.name1 in seen:
			frappe.throw(
				_(
					"Sidebar row {0}: the id {1} is already used by another row. Give this one another name."
				).format(row.idx, frappe.bold(row.name1))
			)
		seen.add(row.name1)

		if row.name1 in LOCKED_VISIBLE and cint(row.hidden):
			frappe.throw(
				_("Sidebar row {0}: Home cannot be switched off. It is the page the app opens on.").format(
					row.idx
				)
			)

		# `icon.mandatory_depends_on` is enforced by frappe's form layout
		# (public/js/frappe/form/layout.js) and by nothing in Python, so any
		# write that does not go through the desk form -- `update_sidebar_item`
		# among them -- stored a row with no icon at all. Develop's `reqd` flag
		# rejected that at insert.
		if row.item_type and row.item_type != "Built-in" and not row.icon:
			frappe.throw(_("Sidebar row {0}: choose an icon for this link.").format(row.idx))

		if row.item_type == "Built-in":
			if row.name1 not in known:
				frappe.throw(
					_("Sidebar row {0}: {1} is not a built-in link. Choose another type for it.").format(
						row.idx, frappe.bold(row.name1)
					)
				)
		elif row.item_type == "Web Page":
			if not row.web_page:
				frappe.throw(_("Sidebar row {0}: choose the web page this link opens.").format(row.idx))
		elif row.item_type == "Route":
			validate_sidebar_route(row)
		elif row.item_type == "External":
			validate_sidebar_url(row)


def validate_sidebar_route(row) -> None:
	if not row.route:
		frappe.throw(
			_("Sidebar row {0}: enter the path this link opens, for example /handbook.").format(row.idx)
		)
	# A path, not a URL. "//host" and "/\\host" are scheme-relative URLs the
	# browser sends off-site, which is exactly what a Route row must not do.
	if not row.route.startswith("/") or row.route[1:2] in ("/", "\\"):
		frappe.throw(
			_(
				"Sidebar row {0}: the path must begin with a single / and stay on this site. Use an External link to leave it."
			).format(row.idx)
		)


def validate_sidebar_url(row) -> None:
	if not row.url:
		frappe.throw(_("Sidebar row {0}: enter the address this link opens.").format(row.idx))
	if not validate_url(row.url, valid_schemes=["http", "https"]):
		frappe.throw(_("Sidebar row {0}: the address must begin with http:// or https://.").format(row.idx))


def get_sidebar_rows(settings) -> list[dict]:
	"""Every row, in idx order, with its target already resolved.

	A Built-in row carries no label or icon: getSidebarItems() owns those, and
	sending a second copy would let the two disagree.
	"""
	rows = []
	for row in settings.sidebar_items:
		hidden = cint(row.hidden)
		rows.append(
			{
				"name": row.name,
				"name1": row.name1,
				"item_type": row.item_type,
				# The real Link value, not name1: name1 is a scrubbed slug, and the
				# legacy web_pages payload is read back as a Web Page document name.
				# Nulled when hidden: a switched-off row must not still ship its
				# destination to every viewer. The row itself stays, so a client
				# can still tell "hidden" from "unknown".
				"web_page": row.web_page if not hidden else None,
				"hidden": hidden,
				"is_standard": cint(row.is_standard),
				"icon": row.icon if not hidden else None,
				"label": row.title if row.item_type != "Built-in" else None,
				"to": sidebar_row_target(row) if not hidden else None,
				"open_in_new_window": cint(row.open_in_new_window),
			}
		)
	return rows


def sidebar_row_target(row) -> str | None:
	if row.item_type in ("Web Page", "Route"):
		return row.route
	if row.item_type == "External":
		return row.url
	return None
