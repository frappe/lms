"""Handy module to make access to all doctypes from a single place.
"""
from .doctype.lms_enrollment.lms_enrollment import (
	LMSBatchMembership as Membership,
)
from .doctype.lms_course.lms_course import LMSCourse as Course
