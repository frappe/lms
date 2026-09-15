import frappe
from frappe.query_builder.functions import Max

PATCH = "lms.patches.v2_0.set_question_marks_from_quizzes"


def already_run() -> bool:
	"""True once this patch has been recorded against the site.

	update_patch_log() stores the whole patches.txt line, `#date` suffix and all,
	so the module path is a prefix of the stored value rather than equal to it.
	"""
	return bool(frappe.db.get_value("Patch Log", {"patch": ("like", f"{PATCH}%"), "skipped": 0}))


def execute():
	"""Seed LMS Question.marks from the quizzes already using each question.

	Marks used to live only on LMS Quiz Question, and the question bank showed the
	value of whichever quiz row came back first. The field is new, so every
	question would otherwise read as its default of 1 and the bank would report a
	number nobody set.

	A question used at different weights takes the highest: no quiz changes, since
	each keeps its own row, but the bank has to name one number.

	Runs once, and both guards earn their place. The Patch Log stops a re-run
	rewriting a weight someone has since chosen by hand, which no test of the data
	alone could catch, because a deliberate 1 is indistinguishable from an
	untouched default. `marks == 1` rather than `<= 1` keeps a deliberate 0, which
	is a real weight, from being read as unset.
	"""
	if already_run():
		return

	if not frappe.db.table_exists("LMS Question") or not frappe.db.table_exists("LMS Quiz Question"):
		return

	quiz_question = frappe.qb.DocType("LMS Quiz Question")
	question = frappe.qb.DocType("LMS Question")

	rows = (
		frappe.qb.from_(quiz_question)
		.inner_join(question)
		.on(question.name == quiz_question.question)
		.select(quiz_question.question.as_("question"), Max(quiz_question.marks).as_("marks"))
		.where(quiz_question.parenttype == "LMS Quiz")
		.where(question.marks == 1)
		.groupby(quiz_question.question)
	).run(as_dict=True)

	for row in rows:
		if row.marks is None:
			continue
		frappe.db.set_value("LMS Question", row.question, "marks", row.marks, update_modified=False)
