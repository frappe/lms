from venv import create

import frappe

from lms.install import create_instructor_role


def execute():
	create_instructor_role()
