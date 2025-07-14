import frappe
from lms.install import create_course_creator_role


def execute():
	create_course_creator_role()
