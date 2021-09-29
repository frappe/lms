import frappe

def execute():
    frappe.reload_doc("lms", "doctype", "course_chapter")
    frappe.reload_doc("lms", "doctype", "course_lesson")

    if not frappe.db.count("Course Chapter"):
        move_chapters()

    if not frappe.db.count("Course Lesson"):
        move_lessons()

    frappe.delete_doc("DocType", "Chapter")
    frappe.delete_doc("DocType", "Lesson")

def move_chapters():
    docs = frappe.get_all("Chapter", fields=["*"])
    for doc in docs:
        if frappe.db.exists("LMS Course", doc.course):
            keys = doc
            keys.update({"doctype": "Course Chapter"})
            del keys["name"]
            frappe.get_doc(keys).save()

def move_lessons():
    docs = frappe.get_all("Lesson", fields=["*"])
    for doc in docs:
        print(frappe.db.exists("Chapter", doc.chapter))
        if frappe.db.exists("Chapter", doc.chapter):
            keys = doc
            print(doc)
            keys.update({"doctype": "Course Lesson"})
            del keys["name"]
            frappe.get_doc(keys).save()
