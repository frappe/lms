import frappe

def get_context(context):
    context.no_cache = 1
    try:
        course_id = frappe.form_dict['course']
    except KeyError:
        frappe.local.flags.redirect_location = '/courses'
        raise frappe.Redirect
    context.course = get_course(course_id)
    #context.course_enrolled = has_enrolled(course_id)
    context.discussions, context.memberships = get_discussions(course_id)
    if context.memberships:
        context.member_type = context.memberships[0].member_type
        if context.member_type != "Student":
            context.batches = [membership.batch for membership in context.memberships]
        context.current_batch = context.memberships[0].batch
        context.author = context.memberships[0].member
    else:
        context.membership_type = None
        context.batches = []
        context.current_batch = None
        context.author = None

def get_course(slug):
    course = frappe.db.get_value('LMS Course', {"slug": slug},
        ['name', 'slug', 'title', 'description'], as_dict=1)

    course['topics'] = frappe.db.get_all('LMS Topic',
        filters={
            'course': course['name']
        },
        fields=['name', 'slug', 'title', 'preview'],
        order_by='creation'
    )
    return course

def get_discussions(slug):
    memberships = get_membership(slug)
    messages = get_messages(memberships[0].batch)
    return messages, memberships

def get_membership(slug):
    memberships = []
    course = frappe.db.get_value("LMS Course", {"slug": slug}, "name")
    member = frappe.db.get_value("Community Member", {"email": frappe.session.user}, "name")
    batches = frappe.get_all("LMS Batch", {"course": course}, ["name"])
    for batch in batches:
        membership = frappe.db.get_value("LMS Batch Membership", {"member": member, "batch": batch.name}, ["batch", "member", "member_type"], as_dict=1)
        if membership:
            memberships.append(membership)
    return memberships

@frappe.whitelist()
def get_messages(batch):
    messages =  frappe.get_all("LMS Message", {"batch": batch}, ["*"], order_by="creation desc")
    for message in messages:
        message.message = frappe.utils.md_to_html(message.message)
        message.creation = frappe.utils.format_datetime(message.creation, "medium")
        message.author_name, member_email = frappe.db.get_value("Community Member", message.author, ["full_name","email"])
        if member_email == frappe.session.user:
            message.author_name = "You"
    return messages

@frappe.whitelist()
def has_enrolled(course):
    return frappe.db.get_value("LMS Course Enrollment", {"course": course, "owner": frappe.session.user})

@frappe.whitelist()
def enroll(course):
    return frappe.get_doc({
                "doctype": "LMS Course Enrollment",
                "course": course,
                "user": frappe.session.user
            }).save()

@frappe.whitelist()
def save_message(message, author, batch):
    doc = frappe.get_doc({
        "doctype": "LMS Message",
        "author": author,
        "batch": batch,
        "message": message
    })
    doc.save(ignore_permissions=True)
    return doc

