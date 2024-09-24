import frappe
from lms.lms.utils import get_lesson_url, get_lessons, get_membership, redirect_to_courses_list


def get_common_context(context):
    """
    Populate the common context for LMS pages.

    Args:
        context (dict): The context dictionary to be populated.

    Returns:
        None
    """
    context.no_cache = 1

    try:
        batch_name = frappe.form_dict['batch']
    except KeyError:
        batch_name = None

    course = frappe.db.get_value(
        'LMS Course',
        frappe.form_dict['course'],
        ['name', 'title', 'video_link', 'enable_certification', 'status'],
        as_dict=True,
    )
    if not course:
        redirect_to_courses_list()

    context.course = course
    context.lessons = get_lessons(course.name)
    membership = get_membership(course.name, frappe.session.user, batch_name)
    context.membership = membership
    context.progress = frappe.utils.cint(membership.progress) if membership else 0
    context.batch_old = (
        membership.batch_old if membership and membership.batch_old else None
    )
    context.course.query_parameter = (
        '?batch=' + membership.batch_old if membership and membership.batch_old else ''
    )
    context.livecode_url = get_livecode_url()


def get_livecode_url():
    """
    Retrieve the livecode URL from LMS Settings.

    Returns:
        str: The livecode URL.
    """
    return frappe.db.get_single_value('LMS Settings', 'livecode_url')


def redirect_to_lesson(course, index_='1.1'):
    """
    Redirect to a specific lesson in the course.

    Args:
        course (dict): The course object.
        index_ (str): The lesson index to redirect to.

    Raises:
        frappe.Redirect: To redirect to the specified lesson.
    """
    frappe.local.flags.redirect_location = (
        get_lesson_url(course.name, index_) + course.query_parameter
    )
    raise frappe.Redirect


def get_current_lesson_details(lesson_number, context, is_edit=False):
    """
    Get details of the current lesson.

    Args:
        lesson_number (str): The lesson number to retrieve.
        context (dict): The context containing lesson information.
        is_edit (bool): Whether the function is called in edit mode.

    Returns:
        dict: The lesson details if found, None otherwise.
    """
    details_list = [lesson for lesson in context.lessons if lesson.number == lesson_number]

    if not details_list:
        if is_edit:
            return None
        else:
            redirect_to_lesson(context.course)

    lesson_info = details_list[0]
    lesson_info.body = lesson_info.body.replace("'", "\\'").replace('"', '\\"')
    return lesson_info


def is_student(batch, member=None):
    """
    Check if the given member is a student in the specified batch.

    Args:
        batch (str): The batch to check.
        member (str, optional): The member to check. Defaults to the current user.

    Returns:
        bool: True if the member is a student in the batch, False otherwise.
    """
    if not member:
        member = frappe.session.user

    return frappe.db.exists(
        'Batch Student',
        {
            'student': member,
            'parent': batch,
        },
    )