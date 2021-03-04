import frappe

def get_context(context):
	context.no_cache = 1
	try:
		course_id = frappe.form_dict['course']
	except KeyError:
		frappe.local.flags.redirect_location = '/courses'
		raise frappe.Redirect
	context.course = get_course(course_id)
	context.course_enrolled = has_enrolled(course_id)

def get_course(name):
	course = frappe.db.get_value('Community Course', name,
		['name', 'title', 'description'], as_dict=1)
	course['topics'] = frappe.db.get_all('Community Course Topic',
		filters={
			'course': name
		},
		fields=['name', 'title', 'description'],
		order_by='creation'
	)
	return course

@frappe.whitelist()
def has_enrolled(course):
	return frappe.db.get_value("Community Course Enrollment", {"course": course, "owner": frappe.session.user})

@frappe.whitelist()
def enroll(course):
	return frappe.get_doc({
				"doctype": "Community Course Enrollment",
				"course": course,
				"user": frappe.session.user
			}).save()

	