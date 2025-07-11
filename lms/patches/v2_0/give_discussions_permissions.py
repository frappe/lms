import frappe
from lms.lms.api import give_discussions_permission


def execute():
	give_discussions_permission()
