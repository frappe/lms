import frappe
from lms.lms.doctype.lms_course.lms_course import can_create_courses
from frappe.utils import cint

@frappe.whitelist(allow_guest=True)
def get_tags(course):
	tags = frappe.db.get_value("LMS Course", course, "tags")
	return tags.split(",") if tags else []

@frappe.whitelist(allow_guest=True)
def get_lesson_count(course):
	lesson_count = 0
	chapters = frappe.get_all("Chapter Reference", {"parent": course}, ["chapter"])
	for chapter in chapters:
		lesson_count += frappe.db.count("Lesson Reference", {"parent": chapter.chapter})

	return lesson_count

@frappe.whitelist(allow_guest=True)
def get_instructors(course):
	instructor_details = []
	instructors = frappe.get_all(
		"Course Instructor", {"parent": course}, order_by="idx", pluck="instructor"
	)
	if not instructors:
		instructors = frappe.db.get_value("LMS Course", course, "owner").split(" ")
	for instructor in instructors:
		instructor_details.append(
			frappe.db.get_value(
				"User",
				instructor,
				["name", "username", "full_name", "user_image"],
				as_dict=True,
			)
		)
	return instructor_details

@frappe.whitelist(allow_guest=True)
def membership(course):
	if frappe.session.user != "Guest":
		membership = frappe.db.get_value("LMS Enrollment",
		{"member": frappe.session.user, "course": course},
		["name", "course", "batch_old", "current_lesson", "member_type", "progress"], as_dict=1)
		if membership:
			progress = frappe.utils.cint(membership.progress)
		else:
			membership, progress = None, None
	else:
		membership, progress = None, None
	return membership, progress

@frappe.whitelist(allow_guest=True)
def get_link_field():
	get_option = []
	get_option.append('')
	# Get fields of type 'Link' from "LMS Course" doctype
	meta_lms = frappe.get_meta("LMS Course")
	for field in meta_lms.fields:
		if field.fieldtype == 'Link':
			get_option.append(field.label)

	# Get fields of type 'Link' from "Batch" doctype
	meta_batch = frappe.get_meta("LMS Batch")
	if meta_batch:
		for field in meta_batch.fields:
			if field.fieldtype == 'Link':
				get_option.append(field.label)

	return set(get_option)

@frappe.whitelist(allow_guest=True)
def get_data_option(data):
	options = None
	reference_doctype = None
	custom_field = None

	# Check in "LMS Course" doctype
	meta_lms = frappe.get_meta("LMS Course")
	for field in meta_lms.fields:
		if field.label == data:
			options = field.options
			reference_doctype = 'LMS Course'
			custom_field = field.fieldname
			break

	# Check in "Batch" doctype if not found in "LMS Course"
	meta_batch = frappe.get_meta("LMS Batch")
	if meta_batch:
		for field in meta_batch.fields:
			if field.label == data:	
				options = field.options
				if reference_doctype:
					reference_doctype += ',' + 'LMS Batch'
				else:
					reference_doctype = 'LMS Batch'
				custom_field = field.fieldname
				break

	return options, reference_doctype, custom_field
		
@frappe.whitelist(allow_guest=True)
def get_lesson_index(course):
	lesson_name = course
	"""Returns the {chapter_index}.{lesson_index} for the lesson."""
	lesson = frappe.db.get_value(
		"Lesson Reference", {"lesson": lesson_name}, ["idx", "parent"], as_dict=True
	)
	if not lesson:
		return "1.1"

	chapter = frappe.db.get_value(
		"Chapter Reference", {"chapter": lesson.parent}, ["idx"], as_dict=True
	)
	if not chapter:
		return "1.1"

	return f"{chapter.idx}.{lesson.idx}"

