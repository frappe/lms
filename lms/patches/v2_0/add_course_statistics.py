import frappe

from lms.lms.doctype.lms_course.lms_course import update_course_statistics


def execute():
	update_course_statistics()
