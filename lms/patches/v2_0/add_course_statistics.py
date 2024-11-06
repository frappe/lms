import frappe
from lms.lms.api import update_course_statistics


def execute():
	update_course_statistics()
