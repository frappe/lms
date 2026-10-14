import frappe

from lms.lms.utils import dump_editorjs, escape_markup, load_editorjs, sanitize_json

# Lesson content is cleaned on save, including text that is not EditorJS JSON and
# JSON keys. Rows saved before that keep their markup until the next save, so they
# are cleaned here. Lesson content is unbounded, so it is read a page at a time.
BATCH_SIZE = 500
FIELDS = ("content", "instructor_content")
# JSON can spell `<` as a `\u003c` escape. Matching the bare `u003c` may also catch
# rows without markup, which `clean_field` then leaves unchanged.
MARKUP_PATTERNS = ("%<%", "%u003c%", "%u003C%")


def execute():
	escaped = []
	last_name = ""
	while lessons := get_lessons_with_markup(after=last_name):
		escaped += [lesson.name for lesson in lessons if clean_lesson(lesson)]
		last_name = lessons[-1].name

	if escaped:
		print(f"Lesson content that is not EditorJS JSON was HTML-escaped in: {', '.join(escaped)}")


def get_lessons_with_markup(after: str):
	"""Every tag needs a `<`, plain or JSON-escaped, so a lesson without one has nothing to clean."""
	return frappe.get_all(
		"Course Lesson",
		filters={"name": [">", after]},
		or_filters=[[fieldname, "like", pattern] for fieldname in FIELDS for pattern in MARKUP_PATTERNS],
		fields=["name", *FIELDS],
		order_by="name asc",
		limit=BATCH_SIZE,
	)


def clean_lesson(lesson) -> bool:
	"""Write each field that changes. Returns whether a field had to be escaped."""
	changes = {}
	escaped = False
	for fieldname in FIELDS:
		cleaned, was_escaped = clean_field(lesson[fieldname])
		if cleaned is not None:
			changes[fieldname] = cleaned
		escaped = escaped or was_escaped
	if changes:
		frappe.db.set_value("Course Lesson", lesson.name, changes, update_modified=False)
	return escaped


def clean_field(raw) -> tuple[str | None, bool]:
	"""`(value to write, escaped)`, with None when the field is already clean.

	Mirrors `sanitize_editorjs`, but parses once and compares the parsed content,
	so a clean row that is only serialised differently is not rewritten."""
	if not has_markup(raw):
		return None, False
	try:
		data, repaired = load_editorjs(raw)
		cleaned = sanitize_json(data)
	except (TypeError, ValueError, RecursionError):
		escaped = escape_markup(raw)
		# Unparseable text with only `\u003c` escapes renders no markup, so it is kept.
		return (escaped, True) if escaped != raw else (None, False)
	if cleaned == data and not repaired:
		return None, False
	return dump_editorjs(cleaned), False


def has_markup(raw) -> bool:
	return bool(raw) and ("<" in raw or "\\u003c" in raw.lower())
