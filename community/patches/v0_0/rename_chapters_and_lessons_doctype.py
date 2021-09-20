import frappe

def execute():
    frappe.reload_doc("lms", "doctype", "lms_course")
    frappe.reload_doc("lms", "doctype", "chapters")
    frappe.reload_doc("lms", "doctype", "chapter")
    frappe.reload_doc("lms", "doctype", "lessons")
    frappe.reload_doc("lms", "doctype", "lesson")
    frappe.reload_doc("lms", "doctype", "chapter_reference")
    frappe.reload_doc("lms", "doctype", "lesson_reference")

    frappe.rename_doc("DocType", "Chapters", "Chapter Reference")
    frappe.reload_doctype("Chapter Reference", force=True)

    frappe.rename_doc("DocType", "Lessons", "Lesson Reference")
    frappe.reload_doctype("Lesson Reference", force=True)
