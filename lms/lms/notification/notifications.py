import frappe
from frappe import _
from frappe.utils import validate_email_address
from frappe.email.doctype.email_template.email_template import get_email_template

def notify_course_completion():
    '''
        Method to notify the course completion on daily basis
    '''
    # Check settings Notify Instructor on Course Completion by EOD is checked true
    notify_instructor_course_completion_eod = frappe.db.get_single_value("LMS Settings", "notify_instructor_course_completion_eod")
    if not notify_instructor_course_completion_eod:
        return

    # Get all completed course(LMS Enrollment) that not send the notification to instructor
    query = '''
        select
            course, member_name, name
        from
            `tabLMS Enrollment`
        where
            instructor_notified_completion!=1 and progress=100
        order by
            course
    '''
    enrollment_details = frappe.db.sql(query, as_dict=True)
    enrollments = {}
    for item in enrollment_details:
        if item.course not in enrollments:
            enrollments[item.course] = {'course': item.course, 'members': [], 'names': []}
        enrollments[item.course]['members'].append(item.member_name)
        enrollments[item.course]['names'].append(item.name)
    enrollments = list(enrollments.values())

    subject = _("Course Completion for Today")
    # Default template configured in lms/templates/emails
    template = "lms_course_completion"

    # Get template for the notification from the settings
    custom_template = frappe.db.get_single_value("LMS Settings", "course_completion_notification_template")

    # Itrate each course in the list and send email to the instructor with students details and course link
    for enrollment in enrollments:
        # Get the instructor(s) of the course, they are the recipient(s) of the notification
        instructors_data = frappe.db.get_all(
            'Course Instructor',
            fields=['instructor'],
            filters={
                "parent": enrollment['course'], "parenttype": "LMS Course"
            }
        )
        instructors = [item['instructor'] for item in instructors_data]
        for instructor in instructors:
            if not validate_email_address(instructor):
                instructors.remove(instructor)

        if instructors and len(instructors) > 0:
            args = {
    			"course_name": frappe.db.get_value('LMS Course', enrollment['course'], 'title'),
                "course": enrollment['course'],
                "members": enrollment['members']
    		}

            if custom_template:
                email_template = get_email_template(custom_template, args)
                subject = email_template.get("subject")
                content = email_template.get("message")

            # Send the notification to the instructors
            frappe.sendmail(
    			recipients=instructors,
    			subject=subject,
    			template=template if not custom_template else None,
    			content=content if custom_template else None,
    			args=args,
    			header=[subject, "green"],
    		)

            # Update LMS Enrollment instructor_notified_completion
            query = '''
                update
                    `tabLMS Enrollment`
                set
                    instructor_notified_completion=1
            '''
            if len(enrollment['names']) == 1:
                query += "where name = '{0}'".format(enrollment['names'][0])
            else:
                query += "where name in {0}".format(tuple(enrollment['names']))
            frappe.db.sql(query)
            frappe.db.commit()
