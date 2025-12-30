import json
import os
import re
import shutil
import xml.etree.ElementTree as ET
import zipfile
from xml.dom.minidom import parseString
import frappe
from frappe.utils import nowdate, now
from datetime import datetime
from frappe.utils import nowdate, add_days
from frappe.exceptions import AuthenticationError, PermissionError, ValidationError
from vlms.api.utils import extract_token_from_header, get_user_from_token
from frappe.utils import nowdate, nowtime
from frappe.utils import nowdate, get_first_day

# -------------------
# Login
# -------------------
import frappe
from frappe.auth import LoginManager
import uuid


@frappe.whitelist(allow_guest=True)
def login(email, password):
    try:
        # 1️⃣ Authenticate
        login_manager = LoginManager()
        login_manager.authenticate(email, password)
        login_manager.post_login()

        user = frappe.get_doc("User", login_manager.user)

        # 2️⃣ Generate PLAIN token (no encryption)
        token = uuid.uuid4().hex

        # 3️⃣ Save token
        user.auth_token = token
        user.token_expiry = frappe.utils.add_days(frappe.utils.now(), 7)
        user.save(ignore_permissions=True)
        frappe.db.commit()

        return {
            "status": "success",
            "code": 200,
            "message": "Login successful",
            "token": token,
            "user": {
                "email": user.email,
                "full_name": user.full_name,
                "mobile_no": user.mobile_no,
                "roles": frappe.get_roles(user.name)
            }
        }

    except frappe.AuthenticationError:
        return {
            "status": "fail",
            "code": 401,
            "message": "Invalid email or password"
        }

    except Exception:
        frappe.log_error(frappe.get_traceback(), "Plain Token Login Error")
        return {
            "status": "fail",
            "code": 500,
            "message": "Server error"
        }


import frappe
from frappe import _
from frappe.integrations.frappe_providers.frappecloud_billing import (
	current_site_info,
	is_fc_site,
)
from frappe.query_builder import DocType
from frappe.translate import get_all_translations
from frappe.utils import (
	add_days,
	cint,
	date_diff,
	flt,
	format_date,
	get_datetime,
	now,
)
from frappe.utils.response import Response

from lms.lms.doctype.course_lesson.course_lesson import save_progress
from lms.lms.utils import get_average_rating, get_lesson_count

@frappe.whitelist(allow_guest=True)
def get_all_courses():
    """
    Fetch all published & non-upcoming LMS Courses
    Matching your database structure.
    """

    user = frappe.session.user

    # Fetch courses from your DB structure
    courses = frappe.get_all(
        "LMS Course",
        filters={
            "published": 1,
            "upcoming": 0
        },
        fields=[
            "name",
            "title",
            "image",
            "category",
            "custom_course_sub_category",
            "short_introduction",
            "course_price",
            "custom_original_course_price",
            "rating",
            "lessons",
            "enrollments",
            "custom_popular_course"
        ],
        order_by="creation desc"
    )

    result = []

    for c in courses:
        # Check enrollment
        is_enrolled = False
        if user != "Guest":
            is_enrolled = frappe.db.exists(
                "LMS Enrollment",
                {"course": c.name, "member": user}
            )

        result.append({
            "course_id": c.name,
            "title": c.title,
            "image": c.image,
            "category": c.category,
            "sub_category": c.custom_course_sub_category,
            "short_desc": c.short_introduction,

            "lessons": c.lessons or 0,
            "enrollments": c.enrollments or 0,
            "rating": float(c.rating) if c.rating else 0,

            "price": float(c.course_price),
            "old_price": float(c.custom_original_course_price),

            "is_enrolled": True if is_enrolled else False,
            "cta_button": "Continue" if is_enrolled else "Enroll Now",

            "is_popular": True if c.custom_popular_course else False,

            "has_quiz": True if has_quiz else False,
        })

    return {
        "success": True,
        "total_courses": len(result),
        "data": result
    }


import frappe
import json
import re

@frappe.whitelist(allow_guest=True)
def get_course_quizzes(course_id):
    try:
        lessons = frappe.get_all(
            "Course Lesson",
            filters={"course": course_id},
            fields=["name", "title", "body", "content"]
        )

        final_quiz_list = []
        regex_pattern = r'Quiz\("([^"]+)"\)'   # For BODY block

        for lesson in lessons:
            quiz_ids = set()

            # --------------------------
            # 1️⃣ Extract quiz from CONTENT (JSON)
            # --------------------------
            if lesson.content:
                try:
                    content_json = json.loads(lesson.content)

                    if isinstance(content_json, dict) and "blocks" in content_json:
                        for block in content_json["blocks"]:
                            if block.get("type") == "quiz":
                                quiz_id = block.get("data", {}).get("quiz")
                                if quiz_id:
                                    quiz_ids.add(quiz_id)

                except Exception:
                    pass  # Ignore JSON errors

            # --------------------------
            # 2️⃣ Extract quiz from BODY (Jinja)
            # --------------------------
            if lesson.body:
                matches = re.findall(regex_pattern, lesson.body)
                for q in matches:
                    quiz_ids.add(q)

            # If no quiz found for this lesson → continue
            if not quiz_ids:
                continue

            # --------------------------
            # 3️⃣ Fetch each quiz details + questions
            # --------------------------
            for quiz_id in quiz_ids:

                quiz = frappe.get_doc("LMS Quiz", quiz_id)

                quiz_questions = frappe.get_all(
                    "LMS Quiz Question",
                    filters={"parent": quiz_id},
                    fields=["question", "marks", "type", "idx"]
                )

                questions_output = []

                for q in quiz_questions:
                    q_doc = frappe.get_doc("LMS Question", q.question)

                    # Only option text (NO is_correct, NO explanation)
                    options = [
                        q_doc.get(f"option_{i}") 
                        for i in range(1, 5)
                        if q_doc.get(f"option_{i}")
                    ]

                    questions_output.append({
                        "question_id": q_doc.name,
                        "question_text": q_doc.question,
                        "type": q_doc.type,
                        "multiple": q_doc.multiple,
                        "marks": q.marks,
                        "options": options
                    })

                final_quiz_list.append({
                    "quiz_id": quiz.name,
                    "title": quiz.title,
                    "total_marks": quiz.total_marks,
                    "passing_percentage": quiz.passing_percentage,
                    "duration": quiz.duration,
                    "lesson_id": lesson.name,
                    "lesson_title": lesson.title,
                    "questions": questions_output
                })

        return {
            "success": True,
            "total_quizzes": len(final_quiz_list),
            "data": final_quiz_list
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Quiz Fetch Error")
        return {"success": False, "message": str(e)}


import frappe
import json

@frappe.whitelist(allow_guest=True)
def get_quiz_full_result(submission_id=None, course_id=None, quiz_id=None, member=None):
    try:
        filters = {}

        # Dynamic filters
        if submission_id:
            filters["name"] = submission_id
        if course_id:
            filters["course"] = course_id
        if quiz_id:
            filters["quiz"] = quiz_id
        if member:
            filters["member"] = member

        # Fetch submission(s)
        submissions = frappe.get_all(
            "LMS Quiz Submission",
            filters=filters,
            fields=[
                "name",
                "quiz",
                "quiz_title",
                "course",
                "member",
                "member_name",
                "score",
                "score_out_of",
                "percentage",
                "passing_percentage",
                "creation"
            ],
            order_by="creation desc"
        )

        if not submissions:
            return {"success": False, "message": "No quiz submissions found"}

        final_output = []

        for sub in submissions:
            # Load full doc (to fetch JSON field)
            doc = frappe.get_doc("LMS Quiz Submission", sub.name)

            # Parse JSON submission field
            submission_json = {}
            if hasattr(doc, "submission") and doc.submission:
                try:
                    submission_json = json.loads(doc.submission)
                except:
                    submission_json = {}

            question_list = submission_json.get("questions", [])

            detailed_questions = []

            # Extract question details along with correct answer
            for q in question_list:
                qid = q.get("question_id")

                # Fetch master question details for correct answer
                question_master = frappe.db.get_value(
                    "LMS Question",
                    qid,
                    [
                        "question",
                        "option_1", "is_correct_1",
                        "option_2", "is_correct_2",
                        "option_3", "is_correct_3",
                        "option_4", "is_correct_4"
                    ],
                    as_dict=True
                )

                correct_answer = None

                if question_master:
                    if question_master["is_correct_1"]:
                        correct_answer = question_master["option_1"]
                    elif question_master["is_correct_2"]:
                        correct_answer = question_master["option_2"]
                    elif question_master["is_correct_3"]:
                        correct_answer = question_master["option_3"]
                    elif question_master["is_correct_4"]:
                        correct_answer = question_master["option_4"]

                detailed_questions.append({
                    "question_id": qid,
                    "question": q.get("question"),
                    "selected_option": q.get("selected_option"),
                    "is_correct": q.get("is_correct"),
                    "correct_answer": correct_answer
                })

            sub["questions"] = detailed_questions
            final_output.append(sub)

        return {
            "success": True,
            "total_attempts": len(final_output),
            "data": final_output
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Full Quiz Result API Error")
        return {"success": False, "message": str(e)}

# filepath: apps/vlms/vlms/vlms/api.py
import frappe
from frappe import _
from frappe.utils import nowdate, getdate

@frappe.whitelist(allow_guest=True)
def list_sessions(counsellor=None, student_email=None, status=None, limit=50, start=0):
    """
    Returns list of Counsellor Session records.
    Filters:
      - counsellor: user/email or name of counsellor link field
      - student_email: filter by student email
      - status: Pending / Accepted / Declined
    Pagination: limit, start
    """
    filters = {}
    if counsellor:
        filters["counsellor"] = counsellor
    if student_email:
        filters["student_email"] = student_email
    if status:
        filters["status"] = status

    sessions = frappe.get_all(
    "Counsellor Session",
    filters=filters,
    fields=[
        "name", "student_name", "student_email", "counsellor",
        "session_date", "slot", "start_time", "end_time", "status"
    ],
    limit_start=int(start),
    limit_page_length=int(limit)
)


    return {"success": True, "data": sessions}


@frappe.whitelist()
def get_session(name):
    """Return full session doc (if user has read permission)."""
    if not name:
        frappe.throw(_("Session id required"))

    doc = frappe.get_doc("Counsellor Session", name)
    # permission check
    user = frappe.session.user
    if not (frappe.has_permission(doc.doctype, "read", doc) or
            doc.counsellor == user or doc.student_email == user or frappe.has_role(user, "System Manager")):
        frappe.throw(_("Not permitted to access this session."), frappe.PermissionError)

    return {"success": True, "data": doc.as_dict()}


@frappe.whitelist(allow_guest=True)
def create_session(student_email, student_name, counsellor=None, session_date=None,
                   slot=None, start_time=None, end_time=None, notes=None):
    """
    Create a new Counsellor Session (status defaults to Pending).
    allow_guest=True so learners from portal can create request; we still validate.
    """
    # minimal validation
    if not student_email or not student_name:
        frappe.throw(_("student_email and student_name are required"))

    doc = frappe.new_doc("Counsellor Session")
    doc.student_email = student_email
    doc.student_name = student_name
    doc.counsellor = counsellor or ""
    if session_date:
        # optional: validate date format
        try:
            getdate(session_date)
            doc.session_date = session_date
        except Exception:
            frappe.throw(_("Invalid session_date"))
    doc.slot = slot or ""
    doc.start_time = start_time or ""
    doc.end_time = end_time or ""
    doc.notes = notes or ""
    doc.status = "Pending"
    doc.insert(ignore_permissions=True)  # allow portal user to create
    # Optionally notify counsellor
    if counsellor:
        try:
            frappe.publish_realtime(event="new_counsellor_session",
                                    message={"name": doc.name, "student": student_name},
                                    user=counsellor)
        except Exception:
            pass

    return {"success": True, "message": "Session created", "name": doc.name}


@frappe.whitelist()
def update_status(name, new_status):
    """
    Update session status. Allowed values: Pending, Accepted, Declined
    Only counsellor assigned to the session, or System Manager, can change to Accepted/Declined.
    """
    valid = ["Pending", "Accepted", "Declined", "Rejected"]
    if new_status not in valid:
        frappe.throw(_("Invalid status"))

    if not name:
        frappe.throw(_("Session id required"))

    doc = frappe.get_doc("Counsellor Session", name)
    user = frappe.session.user

    # permission rules:
    # - counsellor assigned or System Manager can change to Accepted/Declined
    # - student may set to Pending (e.g., cancel) if they are the requester
    if new_status in ("Accepted", "Declined", "Rejected"):
        if not (doc.counsellor == user or frappe.has_role(user, "System Manager")):
            frappe.throw(_("Only assigned counsellor or System Manager can approve/reject"), frappe.PermissionError)

    if new_status == "Pending":
        # allow student to revert to pending (or System Manager)
        if not (doc.student_email == user or frappe.has_role(user, "System Manager")):
            frappe.throw(_("Not permitted to set to Pending"), frappe.PermissionError)

    # update
    doc.status = new_status
    doc.save()
    frappe.db.commit()

    # optional notifications
    try:
        frappe.publish_realtime(event="counsellor_session_status_change",
                                message={"name": doc.name, "status": new_status},
                                user=doc.student_email)
    except Exception:
        pass

    return {"success": True, "message": f"Status updated to {new_status}", "name": doc.name}

@frappe.whitelist()
def list_all_sessions(status=None, limit=50, start=0):
    """
    Returns ALL Counsellor Session requests from all learners.
    Optional filter:
        status: Pending, Accepted, Declined
    """

    filters = {}

    if status:
        filters["status"] = status

    sessions = frappe.get_all(
        "Counsellor Session",
        filters=filters,
        fields=[
            "name",
            "student_name",
            "student_email",
            "counsellor",
            "session_date",
            "slot",
            "start_time",
            "end_time",
            "status"
        ],
        limit_start=int(start),
        limit_page_length=int(limit)
    )

    return {
        "success": True,
        "data": sessions
    }

@frappe.whitelist(allow_guest=True)
def get_session_details(name):
    """
    Returns full session details mapped for mobile UI:
    - Topic = notes
    - Date & Time formatting
    - Counsellor Info + Student Info
    - Duration calculation
    """
    if not name:
        frappe.throw("Session ID is required")

    # Load session doc
    doc = frappe.get_doc("Counsellor Session", name)

    # -----------------------------
    # Format Date
    # -----------------------------
    session_date = ""
    if doc.session_date:
        session_date = frappe.utils.formatdate(doc.session_date, "dd MMMM, yyyy")

    # -----------------------------
    # Format Start Time
    # -----------------------------
    start_time = ""
    if doc.start_time:
        try:
            start_time_str = str(doc.start_time)  # timedelta → string
            start_time = frappe.utils.format_time(start_time_str)
        except Exception:
            start_time = ""

    # -----------------------------
    # Format End Time
    # -----------------------------
    end_time = ""
    if doc.end_time:
        try:
            end_time_str = str(doc.end_time)  # timedelta → string
            end_time = frappe.utils.format_time(end_time_str)
        except Exception:
            end_time = ""

    # -----------------------------
    # Duration Calculation
    # -----------------------------
    duration = ""
    try:
        if doc.start_time and doc.end_time:
            from datetime import datetime
            fmt = "%H:%M:%S"

            s = datetime.strptime(str(doc.start_time), fmt)
            e = datetime.strptime(str(doc.end_time), fmt)
            mins = int((e - s).total_seconds() / 60)

            duration = f"{mins} min"
    except Exception:
        duration = ""

    # -----------------------------
    # Counsellor Info
    # -----------------------------
    counsellor_info = None
    if doc.counsellor:
        try:
            user = frappe.get_doc("User", doc.counsellor)
            counsellor_info = {
                "full_name": user.full_name,
                "email": user.email,
                "profile_image": user.user_image,
                "designation": user.get("designation") or "",
                "previous_sessions": frappe.db.count(
                    "Counsellor Session",
                    {"counsellor": doc.counsellor, "status": "Accept"}
                )
            }
        except Exception:
            counsellor_info = None

    # -----------------------------
    # Final Response
    # -----------------------------
    response = {
        "session_id": doc.name,
        "student": {
            "name": doc.student_name,
            "email": doc.student_email,
            "image": doc.student_image
        },
        "counsellor": counsellor_info,
        "topic": doc.notes,  # HERE: Notes → Topic
        "date": session_date,
        "start_time": start_time,
        "end_time": end_time,
        "duration": duration,
        "slot": doc.slot,
        "session_type": "One-on-One Video Call",
        "earnings": 1500,
        "status": doc.status
    }

    return {"success": True, "data": response}

@frappe.whitelist()
def get_all_course_reviews(limit=50, start=0):
    """
    Returns ALL LMS Course Reviews
    (All courses + all ratings + reviews)
    """

    reviews = frappe.get_all(
        "LMS Course Review",
        fields=[
            "name",
            "course",
            "rating",
            "review",
            "owner",
            "creation"
        ],
        order_by="creation desc",
        limit_start=int(start),
        limit_page_length=int(limit)
    )

    data = []

    for r in reviews:
        data.append({
            "review_id": r.name,
            "course": r.course,
            "rating": r.rating,
            "review": r.review,
            "created_by": r.owner,
            "created_on": frappe.utils.format_datetime(r.creation)
        })

    return {
        "success": True,
        "total": len(data),
        "data": data
    }

@frappe.whitelist()
def get_dashboard_data(
    session_status=None,
    session_limit=50,
    session_start=0,
    review_limit=50,
    review_start=0
):
    """
    Single API to return:
    1) All Counsellor Sessions
    2) All LMS Course Reviews
    """

    # ----------------------------
    # 1️⃣ Counsellor Sessions
    # ----------------------------
    session_filters = {}
    if session_status:
        session_filters["status"] = session_status

    sessions = frappe.get_all(
        "Counsellor Session",
        filters=session_filters,
        fields=[
            "name",
            "student_name",
            "student_email",
            "counsellor",
            "session_date",
            "slot",
            "start_time",
            "end_time",
            "status"
        ],
        limit_start=int(session_start),
        limit_page_length=int(session_limit),
        order_by="creation desc"
    )

    session_data = []
    from datetime import datetime

    for s in sessions:
        # Date
        session_date = ""
        if s.session_date:
            session_date = frappe.utils.formatdate(s.session_date, "dd MMM yyyy")

        # Time formatting
        start_time = ""
        end_time = ""
        try:
            if s.start_time:
                start_time = frappe.utils.format_time(str(s.start_time))
            if s.end_time:
                end_time = frappe.utils.format_time(str(s.end_time))
        except:
            pass

        # Duration
        duration = ""
        try:
            if s.start_time and s.end_time:
                st = datetime.strptime(str(s.start_time), "%H:%M:%S")
                et = datetime.strptime(str(s.end_time), "%H:%M:%S")
                mins = int((et - st).total_seconds() / 60)
                duration = f"{mins} min"
        except:
            pass

        session_data.append({
            "session_id": s.name,
            "student_name": s.student_name,
            "student_email": s.student_email,
            "counsellor": s.counsellor,
            "date": session_date,
            "start_time": start_time,
            "end_time": end_time,
            "duration": duration,
            "slot": s.slot,
            "status": s.status
        })

    # ----------------------------
    # 2️⃣ Course Reviews
    # ----------------------------
    reviews = frappe.get_all(
        "LMS Course Review",
        fields=[
            "name",
            "course",
            "rating",
            "review",
            "owner",
            "creation"
        ],
        order_by="creation desc",
        limit_start=int(review_start),
        limit_page_length=int(review_limit)
    )

    review_data = []
    for r in reviews:
        review_data.append({
            "review_id": r.name,
            "course": r.course,
            "rating": r.rating,
            "review": r.review,
            "created_by": r.owner,
            "created_on": frappe.utils.format_datetime(r.creation)
        })

    # ----------------------------
    # FINAL RESPONSE
    # ----------------------------
    return {
        "success": True,
        "sessions": {
            "total": len(session_data),
            "data": session_data
        },
        "reviews": {
            "total": len(review_data),
            "data": review_data
        }
    }


@frappe.whitelist()
def reschedule_session(
    session_id=None,
    new_session_date=None,
    new_start_time=None,
    new_end_time=None,
    reschedule_reason=None
):
    data = frappe.request.get_json() or {}

    session_id = session_id or data.get("session_id")
    new_session_date = new_session_date or data.get("new_session_date")
    new_start_time = new_start_time or data.get("new_start_time")
    new_end_time = new_end_time or data.get("new_end_time")
    reschedule_reason = reschedule_reason or data.get("reschedule_reason")

    if not frappe.db.exists("Counsellor Session", session_id):
        frappe.throw("Session does not exist")

    doc = frappe.get_doc("Counsellor Session", session_id)

    # 🔹 Update schedule
    doc.session_date = new_session_date
    doc.start_time = new_start_time
    doc.end_time = new_end_time
    doc.status = "Accept"

    # 🔹 Save ONLY counsellor reschedule reason (no topic, no notes)
    if reschedule_reason:
        doc.reschedule_reason = reschedule_reason

    doc.save(ignore_permissions=True)
    frappe.db.commit()

    return {
        "success": True,
        "message": "Session rescheduled successfully",

        "session": {
            "session_id": doc.name,
            "status": doc.status,
            "new_date": frappe.utils.formatdate(doc.session_date),
            "new_start_time": str(doc.start_time),
            "new_end_time": str(doc.end_time)
        },

        "learner": {
            "name": doc.student_name,
            "email": doc.student_email,
            "image": doc.student_image
        },

        # ✅ ONLY counsellor reason
        "reschedule_reason": doc.get("reschedule_reason")
    }

@frappe.whitelist()
def counsellor_wallet_summary_no_wallet(counsellor):
    percent = frappe.db.get_value("User", counsellor, "revenue_percentage") or 0

    data = frappe.db.sql("""
        SELECT
            SUM(amount * %s / 100) as total
        FROM `tabLMS Payment`
        WHERE payment_received = 1
    """, percent, as_dict=True)[0]

    return {
        "total_earning": data.total or 0
    }


import frappe
from frappe.utils import formatdate, format_time, time_diff_in_seconds

@frappe.whitelist(allow_guest=False)
def session_booking_notifications(session_id=None, limit=20):

    try:
        # --------------------------
        # Token Authentication
        # --------------------------
        token = extract_token_from_header()
        user = get_user_from_token(token)

        if not user:
            raise AuthenticationError("Invalid or expired token.")

        # ✅ SAFE JSON read (sirf POST ke liye)
        if frappe.request.method == "POST":
            data = frappe.request.get_json(silent=True) or {}
            session_id = session_id or data.get("session_id")

        filters = {}

        if session_id:
            filters["name"] = session_id

        sessions = frappe.get_all(
            "Counsellor Session",
            filters=filters,
            fields=[
                "name",
                "student_name",
                "session_date",
                "start_time",
                "creation"
            ],
            order_by="creation desc",
            limit_page_length=int(limit)
        )

        notifications = []

        for doc in sessions:
            message = (
                f"Your session with {doc.student_name} "
                f"is confirmed for {formatdate(doc.session_date)} "
                f"at {format_time(doc.start_time)}"
            )

            seconds = time_diff_in_seconds(
                frappe.utils.now_datetime(), doc.creation
            )

            if seconds < 60:
                time_ago = "just now"
            elif seconds < 3600:
                time_ago = f"{int(seconds / 60)} mins ago"
            elif seconds < 86400:
                time_ago = f"{int(seconds / 3600)} hrs ago"
            else:
                time_ago = f"{int(seconds / 86400)} days ago"

            notifications.append({
                "session_id": doc.name,
                "message": message,
                "time_ago": time_ago
            })

        return {
            "status": "success",
            "count": len(notifications),
            "notifications": notifications
        }

    except AuthenticationError as e:
        return {
            "status": "fail",
            "code": 401,
            "error_type": "AuthenticationError",
            "message": str(e)
        }

    except Exception as e:
        frappe.log_error("Session Booking Notifications API Error", str(e))
        return {
            "status": "fail",
            "code": 500,
            "error_type": "ServerError",
            "message": "Unable to fetch session booking notifications"
        }



import frappe
from frappe.utils import time_diff_in_seconds
@frappe.whitelist(allow_guest=False)
def course_feedback_notifications(limit=20):
    """
    Returns feedback notifications from LMS Course Review
    """

    try:
        # --------------------------
        # Token Authentication
        # --------------------------
        token = extract_token_from_header()
        user = get_user_from_token(token)

        if not user:
            raise AuthenticationError("Invalid or expired token.")

        reviews = frappe.get_all(
            "LMS Course Review",
            fields=[
                "name",        # 👈 LMS Course Review ID
                "rating",
                "owner",
                "creation"
            ],
            order_by="creation desc",
            limit_page_length=int(limit)
        )

        notifications = []

        for r in reviews:
            # Learner name
            learner_name = frappe.db.get_value(
                "User", r.owner, "full_name"
            ) or r.owner

            # Message
            message = (
                f"New feedback received from {learner_name}: "
                f"{int(r.rating)} stars"
            )

            # Time ago
            seconds = time_diff_in_seconds(
                frappe.utils.now_datetime(), r.creation
            )

            if seconds < 60:
                time_ago = "just now"
            elif seconds < 3600:
                time_ago = f"{int(seconds/60)} mins ago"
            elif seconds < 86400:
                time_ago = f"{int(seconds/3600)} hrs ago"
            else:
                time_ago = f"{int(seconds/86400)} days ago"

            notifications.append({
                "id": r.name,          # 👈 LMS Course Review ID
                "message": message,
                "time_ago": time_ago
            })

        return {
            "status": "success",
            "count": len(notifications),
            "notifications": notifications
        }

    except AuthenticationError as e:
        return {
            "status": "fail",
            "code": 401,
            "error_type": "AuthenticationError",
            "message": str(e)
        }

    except Exception as e:
        frappe.log_error("Course Feedback Notifications API Error", str(e))
        return {
            "status": "fail",
            "code": 500,
            "error_type": "ServerError",
            "message": "Unable to fetch course feedback notifications"
        }



import frappe
from frappe.utils import (
    formatdate,
    format_time,
    time_diff_in_seconds
)



@frappe.whitelist(allow_guest=False)
def all_notifications(session_id=None, limit=20):
    """
    Returns BOTH:
    - Session booking notifications
    - Course feedback notifications
    """

    try:
        # --------------------------
        # Token Authentication
        # --------------------------
        token = extract_token_from_header()
        user = get_user_from_token(token)

        if not user:
            raise AuthenticationError("Invalid or expired token.")

        notifications = []

        # --------------------------------------------------
        # 1️⃣ SESSION BOOKING NOTIFICATIONS
        # --------------------------------------------------
        if frappe.request.method == "POST":
            data = frappe.request.get_json(silent=True) or {}
            session_id = session_id or data.get("session_id")

        session_filters = {}
        if session_id:
            session_filters["name"] = session_id

        sessions = frappe.get_all(
            "Counsellor Session",
            filters=session_filters,
            fields=[
                "name",
                "student_name",
                "session_date",
                "start_time",
                "creation"
            ],
            order_by="creation desc",
            limit_page_length=int(limit)
        )

        for doc in sessions:
            message = (
                f"Your session with {doc.student_name} "
                f"is confirmed for {formatdate(doc.session_date)} "
                f"at {format_time(doc.start_time)}"
            )

            seconds = time_diff_in_seconds(
                frappe.utils.now_datetime(), doc.creation
            )

            if seconds < 60:
                time_ago = "just now"
            elif seconds < 3600:
                time_ago = f"{int(seconds/60)} mins ago"
            elif seconds < 86400:
                time_ago = f"{int(seconds/3600)} hrs ago"
            else:
                time_ago = f"{int(seconds/86400)} days ago"

            notifications.append({
                "message": message,
                "id": doc.name,
                "time_ago": time_ago
            })

        # --------------------------------------------------
        # 2️⃣ COURSE FEEDBACK NOTIFICATIONS
        # --------------------------------------------------
        reviews = frappe.get_all(
            "LMS Course Review",
            fields=[
                "name",
                "rating",
                "owner",
                "creation"
            ],
            order_by="creation desc",
            limit_page_length=int(limit)
        )

        for r in reviews:
            learner_name = frappe.db.get_value(
                "User", r.owner, "full_name"
            ) or r.owner

            message = (
                f"New feedback received from {learner_name}: "
                f"{int(r.rating)} stars"
            )

            seconds = time_diff_in_seconds(
                frappe.utils.now_datetime(), r.creation
            )

            if seconds < 60:
                time_ago = "just now"
            elif seconds < 3600:
                time_ago = f"{int(seconds/60)} mins ago"
            elif seconds < 86400:
                time_ago = f"{int(seconds/3600)} hrs ago"
            else:
                time_ago = f"{int(seconds/86400)} days ago"

            notifications.append({
                "id": r.name,
                "message": message,
                "id": doc.name,
                "time_ago": time_ago
            })

        # --------------------------------------------------
        # 3️⃣ SORT ALL NOTIFICATIONS (LATEST FIRST)
        # --------------------------------------------------
        notifications.sort(
            key=lambda x: x["time_ago"],
            reverse=True
        )

        return {
            "status": "success",
            "count": len(notifications),
            "notifications": notifications
        }

    except AuthenticationError as e:
        return {
            "status": "fail",
            "code": 401,
            "error_type": "AuthenticationError",
            "message": str(e)
        }

    except Exception as e:
        frappe.log_error("All Notifications API Error", str(e))
        return {
            "status": "fail",
            "code": 500,
            "error_type": "ServerError",
            "message": "Unable to fetch notifications"
        }


@frappe.whitelist(allow_guest=False)
def get_payment_dashboard_summary():
    """
    Returns:
    - Total Paid Amount (all courses + batches + sessions)
    - Total Enrolled Count (unique courses / batches)
    """

    try:
        # --------------------------
        # Token Authentication
        # --------------------------
        token = extract_token_from_header()
        user_doc = get_user_from_token(token)

        if not user_doc:
            raise AuthenticationError("Invalid or expired token.")

        user_email = user_doc.name
        roles = frappe.get_roles(user_email)

        # --------------------------
        # FILTER: Admin vs User
        # --------------------------
        payment_filters = {"payment_received": 1}

        if "System Manager" not in roles:
            payment_filters["member"] = user_email

        # --------------------------
        # 1️⃣ TOTAL PAID AMOUNT
        # --------------------------
        payments = frappe.get_all(
            "LMS Payment",
            filters=payment_filters,
            fields=["amount"]
        )

        total_paid = sum(p.amount or 0 for p in payments)

        # --------------------------
        # 2️⃣ ENROLLED COURSES / BATCHES
        # --------------------------
        enrollment_filters = {}

        if "System Manager" not in roles:
            enrollment_filters["member"] = user_email

        # LMS Enrollment (Courses)
        course_enrollments = frappe.get_all(
            "LMS Enrollment",
            filters=enrollment_filters,
            fields=["course"],
            distinct=True
        )

        # LMS Batch Enrollment (Batches)
        batch_enrollments = frappe.get_all(
            "LMS Batch Enrollment",
            filters=enrollment_filters,
            fields=["batch"],
            distinct=True
        )

        enrolled_count = len(course_enrollments) + len(batch_enrollments)

        return {
            "status": "success",
            "data": {
                "total_paid": total_paid,
                "enrolled_count": enrolled_count
            }
        }

    except AuthenticationError as e:
        return {
            "status": "fail",
            "code": 401,
            "message": str(e)
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Payment Dashboard Summary Error")
        return {
            "status": "fail",
            "code": 500,
            "message": "Unable to fetch payment dashboard summary"
        }

@frappe.whitelist(allow_guest=False)
def get_payment_history(limit=20):
    """
    Returns payment history for UI
    - Learner → own history
    - Admin → all history
    """

    try:
        # --------------------------
        # Token Authentication
        # --------------------------
        token = extract_token_from_header()
        user_doc = get_user_from_token(token)

        if not user_doc:
            raise AuthenticationError("Invalid or expired token.")

        user_email = user_doc.name
        roles = frappe.get_roles(user_email)

        # --------------------------
        # Filters
        # --------------------------
        filters = {}

        if "System Manager" not in roles:
            filters["member"] = user_email

        # --------------------------
        # Fetch Payments
        # --------------------------
        payments = frappe.get_all(
            "LMS Payment",
            filters=filters,
            fields=[
                "name",
                "payment_for_document_type",
                "payment_for_document",
                "amount",
                "currency",
                "payment_received",
                "creation"
            ],
            order_by="creation desc",
            limit_page_length=int(limit)
        )

        history = []

        for p in payments:
            title = p.payment_for_document or p.payment_for_document_type

            history.append({
                "payment_id": p.name,
                "title": title,
                "amount": p.amount,
                "currency": p.currency or "INR",
                "date": frappe.utils.formatdate(p.creation, "MMM d, yyyy"),
                "payment_method": "UPI",   # ✅ safe default
                "status": "Success" if p.payment_received else "Pending",
                "receipt_url": (
                    f"/api/method/frappe.utils.print_format.download_pdf"
                    f"?doctype=LMS Payment&name={p.name}&format=Standard"
                )
            })

        return {
            "status": "success",
            "count": len(history),
            "history": history
        }

    except AuthenticationError as e:
        return {
            "status": "fail",
            "code": 401,
            "message": str(e)
        }

    except Exception:
        # 🔥 VERY IMPORTANT FOR DEBUGGING
        frappe.log_error(frappe.get_traceback(), "Payment History API Error")
        return {
            "status": "fail",
            "code": 500,
            "message": "Unable to fetch payment history"
        }
    
@frappe.whitelist(allow_guest=False)
def get_payment_dashboard_and_history(limit=20):
    """
    SINGLE API that returns:
    1) Payment Dashboard Summary
       - total_paid
       - enrolled_count
    2) Payment History (UI ready)

    Rules:
    - Learner → only own data
    - Admin (System Manager) → all data
    """

    try:
        # --------------------------
        # Token Authentication
        # --------------------------
        token = extract_token_from_header()
        user_doc = get_user_from_token(token)

        if not user_doc:
            raise AuthenticationError("Invalid or expired token.")

        user_email = user_doc.name
        roles = frappe.get_roles(user_email)

        is_admin = "System Manager" in roles

        # ==================================================
        # 1️⃣ DASHBOARD SUMMARY
        # ==================================================

        payment_filters = {"payment_received": 1}
        if not is_admin:
            payment_filters["member"] = user_email

        payments_for_sum = frappe.get_all(
            "LMS Payment",
            filters=payment_filters,
            fields=["amount"]
        )

        total_paid = sum(p.amount or 0 for p in payments_for_sum)

        # Enrollments
        enrollment_filters = {}
        if not is_admin:
            enrollment_filters["member"] = user_email

        course_enrollments = frappe.get_all(
            "LMS Enrollment",
            filters=enrollment_filters,
            fields=["course"],
            distinct=True
        )

        batch_enrollments = frappe.get_all(
            "LMS Batch Enrollment",
            filters=enrollment_filters,
            fields=["batch"],
            distinct=True
        )

        enrolled_count = len(course_enrollments) + len(batch_enrollments)

        # ==================================================
        # 2️⃣ PAYMENT HISTORY
        # ==================================================

        history_filters = {}
        if not is_admin:
            history_filters["member"] = user_email

        payments = frappe.get_all(
            "LMS Payment",
            filters=history_filters,
            fields=[
                "name",
                "payment_for_document_type",
                "payment_for_document",
                "amount",
                "currency",
                "payment_received",
                "creation"
            ],
            order_by="creation desc",
            limit_page_length=int(limit)
        )

        history = []

        for p in payments:
            history.append({
                "payment_id": p.name,
                "title": p.payment_for_document or p.payment_for_document_type,
                "amount": p.amount,
                "currency": p.currency or "INR",
                "date": frappe.utils.formatdate(p.creation, "MMM d, yyyy"),
                "payment_method": "UPI",  # safe default
                "status": "Success" if p.payment_received else "Pending",
                "receipt_url": (
                    f"/api/method/frappe.utils.print_format.download_pdf"
                    f"?doctype=LMS Payment&name={p.name}&format=Standard"
                )
            })

        # ==================================================
        # FINAL RESPONSE
        # ==================================================

        return {
            "status": "success",
            "dashboard": {
                "total_paid": total_paid,
                "enrolled_count": enrolled_count
            },
            "history": history
        }

    except AuthenticationError as e:
        return {
            "status": "fail",
            "code": 401,
            "message": str(e)
        }

    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            "Payment Dashboard + History API Error"
        )
        return {
            "status": "fail",
            "code": 500,
            "message": "Unable to fetch payment dashboard and history"
        }
@frappe.whitelist(allow_guest=False)
def get_counsellor_wallet(limit=20):
    """
    Counsellor Wallet API

    - Earnings only from counsellor's courses
    - Revenue percentage applied
    - Week / Month / Total earnings
    - Payment history
    """

    try:
        # --------------------------
        # TOKEN AUTHENTICATION
        # --------------------------
        token = extract_token_from_header()
        user_doc = get_user_from_token(token)

        if not user_doc:
            frappe.throw("Invalid or expired token")

        counsellor = user_doc.name  # email

        # --------------------------
        # GET REVENUE PERCENTAGE
        # --------------------------
        revenue_percentage = (
            frappe.db.get_value("User", counsellor, "revenue_percentage") or 0
        )
        revenue_factor = revenue_percentage / 100

        # --------------------------
        # COUNSELLOR COURSES
        # --------------------------
        course_names = frappe.get_all(
            "Course Instructor",
            filters={"instructor": counsellor},
            pluck="parent"
        )

        if not course_names:
            return {
                "status": "success",
                "summary": {
                    "week_earning": 0,
                    "month_earning": 0,
                    "total_earning": 0
                },
                "history": []
            }

        # --------------------------
        # DATE RANGES
        # --------------------------
        today = frappe.utils.nowdate()
        week_start = frappe.utils.add_days(today, -7)
        month_start = frappe.utils.get_first_day(today)

        # --------------------------
        # TOTAL EARNING
        # --------------------------
        total_earning = frappe.db.sql(
            """
            SELECT SUM(amount * %(factor)s)
            FROM `tabLMS Payment`
            WHERE payment_received = 1
              AND payment_for_document_type = 'LMS Course'
              AND payment_for_document IN %(courses)s
            """,
            {
                "courses": tuple(course_names),
                "factor": revenue_factor
            }
        )[0][0] or 0

        # --------------------------
        # WEEK EARNING
        # --------------------------
        week_earning = frappe.db.sql(
            """
            SELECT SUM(amount * %(factor)s)
            FROM `tabLMS Payment`
            WHERE payment_received = 1
              AND payment_for_document_type = 'LMS Course'
              AND payment_for_document IN %(courses)s
              AND creation >= %(week_start)s
            """,
            {
                "courses": tuple(course_names),
                "week_start": week_start,
                "factor": revenue_factor
            }
        )[0][0] or 0

        # --------------------------
        # MONTH EARNING
        # --------------------------
        month_earning = frappe.db.sql(
            """
            SELECT SUM(amount * %(factor)s)
            FROM `tabLMS Payment`
            WHERE payment_received = 1
              AND payment_for_document_type = 'LMS Course'
              AND payment_for_document IN %(courses)s
              AND creation >= %(month_start)s
            """,
            {
                "courses": tuple(course_names),
                "month_start": month_start,
                "factor": revenue_factor
            }
        )[0][0] or 0

        # --------------------------
        # PAYMENT HISTORY
        # --------------------------
        payments = frappe.get_all(
            "LMS Payment",
            filters={
                "payment_received": 1,
                "payment_for_document_type": "LMS Course",
                "payment_for_document": ["in", course_names]
            },
            fields=["member", "amount", "creation"],
            order_by="creation desc",
            limit_page_length=int(limit)
        )

        history = []
        for p in payments:
            learner_name = frappe.db.get_value(
                "User", p.member, "full_name"
            ) or p.member

            history.append({
                "received_from": learner_name,
                "amount": round((p.amount or 0) * revenue_factor, 2),
                "date": frappe.utils.formatdate(p.creation, "d MMM yyyy")
            })

        # --------------------------
        # FINAL RESPONSE
        # --------------------------
        return {
            "status": "success",
            "summary": {
                "week_earning": round(week_earning, 2),
                "month_earning": round(month_earning, 2),
                "total_earning": round(total_earning, 2)
            },
            "history": history
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Counsellor Wallet API Error")
        return {
            "status": "fail",
            "code": 500,
            "message": str(e)
        }

    import frappe
from datetime import date, datetime

@frappe.whitelist(allow_guest=True)
def today_sessions_summary():
    try:
        today = date.today()
        now = datetime.now()
        now_minutes = now.hour * 60 + now.minute

        batches = frappe.get_all(
            "LMS Batch",
            filters={
                "start_date": ["<=", today],
                "end_date": [">=", today],
                "published": ["!=", 0]
            },
            fields=[
                "name",
                "start_time",
                "end_time"
            ],
            order_by="start_time asc"
        )

        total_sessions = len(batches)
        total_duration_minutes = 0
        next_session_starts_at = None

        for b in batches:
            if b.start_time and b.end_time:
                duration = b.end_time - b.start_time
                total_duration_minutes += int(duration.total_seconds() // 60)

                start_minutes = int(b.start_time.total_seconds() // 60)
                if not next_session_starts_at and start_minutes > now_minutes:
                    hours = start_minutes // 60
                    minutes = start_minutes % 60
                    next_session_starts_at = datetime.strptime(
                        f"{hours}:{minutes}", "%H:%M"
                    ).strftime("%I:%M %p")

        return {
            "status": "success",
            "code": 200,
            "data": {
                "total_sessions_today": total_sessions,
                "total_duration_minutes": total_duration_minutes,
                "total_duration": f"{total_duration_minutes // 60}h {total_duration_minutes % 60}m",
                "next_session_starts_at": next_session_starts_at
            }
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Today Sessions Summary")
        return {
            "status": "fail",
            "code": 500,
            "message": str(e)
        }
import frappe
from datetime import date, datetime

@frappe.whitelist(allow_guest=True)
def today_all_sessions():
    try:
        today = date.today()

        rows = frappe.db.sql("""
            SELECT
                b.name AS batch_id,
                b.custom_topic AS batch_title,
                b.start_time,
                b.end_time,
                e.member AS learner,
                u.full_name,
                u.user_type
            FROM `tabLMS Batch Enrollment` e
            INNER JOIN `tabLMS Batch` b
                ON b.name = e.batch
            INNER JOIN `tabUser` u
                ON u.name = e.member
            WHERE
                b.published = 1
                AND b.start_date <= %s
                AND b.end_date >= %s
            ORDER BY b.start_time ASC
        """, (today, today), as_dict=True)

        sessions = []

        for r in rows:
            duration_minutes = int((r.end_time - r.start_time).total_seconds() // 60)

            start_minutes = int(r.start_time.total_seconds() // 60)
            hours = start_minutes // 60
            minutes = start_minutes % 60
            start_time_formatted = datetime.strptime(
                f"{hours}:{minutes}", "%H:%M"
            ).strftime("%I:%M %p")

            sessions.append({
                "start_time": start_time_formatted,
                "duration": f"{duration_minutes} min",
                "learner_name": r.full_name,
                "topic": r.batch_title,   # ✅ custom_topic
                "learner_type": r.user_type,
                "batch_id": r.batch_id
            })

        return {
            "status": "success",
            "code": 200,
            "data": sessions
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Today All Sessions API")
        return {
            "status": "fail",
            "code": 500,
            "message": str(e)
        }

import frappe
from datetime import date, datetime, time, timedelta
from vlms.api.utils import extract_token_from_header, get_user_from_token, AuthenticationError


# -----------------------------------
# HELPER: convert timedelta → time
# -----------------------------------
def to_time(val):
    if isinstance(val, timedelta):
        total_minutes = int(val.total_seconds() // 60)
        return time(total_minutes // 60, total_minutes % 60)
    return val


@frappe.whitelist(allow_guest=False)
def today_dashboard_sessions():
    try:
        # -----------------------------------
        # TOKEN AUTH
        # -----------------------------------
        token = extract_token_from_header()
        if not token:
            raise AuthenticationError("Authentication token missing")

        user = get_user_from_token(token)
        if not user:
            raise AuthenticationError("Invalid token")

        instructor = user.name
        today = date.today()
        now = datetime.now()
        now_minutes = now.hour * 60 + now.minute

        # -----------------------------------
        # 1️⃣ BATCHES WHERE USER IS INSTRUCTOR
        # (Course Instructor child table)
        # -----------------------------------
        batch_names = frappe.get_all(
            "Course Instructor",
            filters={
                "instructor": instructor,
                "parenttype": "LMS Batch"
            },
            pluck="parent"
        )

        if not batch_names:
            return {
                "status": "success",
                "code": 200,
                "data": {
                    "summary": {
                        "total_sessions_today": 0,
                        "total_duration_minutes": 0,
                        "total_duration": "0h 0m",
                        "next_session_starts_at": None
                    },
                    "sessions": []
                }
            }

        # -----------------------------------
        # 2️⃣ TODAY'S BATCHES
        # -----------------------------------
        batches = frappe.get_all(
            "LMS Batch",
            filters={
                "name": ["in", batch_names],
                "published": 1,
                "start_date": ["<=", today],
                "end_date": [">=", today]
            },
            fields=[
                "name",
                "start_time",
                "end_time",
                "custom_topic"
            ],
            order_by="start_time asc"
        )

        total_sessions_today = len(batches)
        total_duration_minutes = 0
        next_session_starts_at = None

        for b in batches:
            st = to_time(b.start_time)
            et = to_time(b.end_time)

            if st and et:
                duration = (
                    datetime.combine(today, et) -
                    datetime.combine(today, st)
                )
                total_duration_minutes += int(duration.total_seconds() // 60)

                start_minutes = st.hour * 60 + st.minute
                if not next_session_starts_at and start_minutes > now_minutes:
                    next_session_starts_at = st.strftime("%I:%M %p")

        # -----------------------------------
        # 3️⃣ LEARNER SESSIONS
        # -----------------------------------
        enrollments = frappe.get_all(
            "LMS Batch Enrollment",
            filters={"batch": ["in", batch_names]},
            fields=["batch", "member"]
        )

        sessions = []

        for e in enrollments:
            batch = next((b for b in batches if b.name == e.batch), None)
            if not batch:
                continue

            learner = frappe.get_doc("User", e.member)

            st = to_time(batch.start_time)
            et = to_time(batch.end_time)

            duration_minutes = int(
                (
                    datetime.combine(today, et) -
                    datetime.combine(today, st)
                ).total_seconds() // 60
            )

            sessions.append({
                "start_time": st.strftime("%I:%M %p"),
                "duration": f"{duration_minutes} min",
                "learner_name": learner.full_name,
                "topic": batch.custom_topic,
                "learner_type": learner.user_type,
                "batch_id": batch.name
            })

        # -----------------------------------
        # FINAL RESPONSE
        # -----------------------------------
        return {
            "status": "success",
            "code": 200,
            "data": {
                "summary": {
                    "total_sessions_today": total_sessions_today,
                    "total_duration_minutes": total_duration_minutes,
                    "total_duration": f"{total_duration_minutes // 60}h {total_duration_minutes % 60}m",
                    "next_session_starts_at": next_session_starts_at
                },
                "sessions": sessions
            }
        }

    except AuthenticationError as e:
        return {
            "status": "fail",
            "code": 401,
            "message": str(e)
        }
    
    

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Instructor Today Dashboard API")
        return {
            "status": "fail",
            "code": 500,
            "message": str(e)
        }


import frappe
import re
from datetime import date, datetime, time, timedelta
from vlms.api.utils import extract_token_from_header, get_user_from_token, AuthenticationError


# -----------------------------------
# helper: timedelta → time
# -----------------------------------
def to_time(val):
    if isinstance(val, timedelta):
        total_minutes = int(val.total_seconds() // 60)
        return time(total_minutes // 60, total_minutes % 60)
    return val


# -----------------------------------
# helper: remove HTML tags
# -----------------------------------
def strip_html(html):
    if not html:
        return ""
    return re.sub(r"<[^>]*>", "", html).strip()


@frappe.whitelist(allow_guest=False)
def session_details(batch_id: str, learner: str):
    try:
        # -----------------------------------
        # TOKEN AUTH
        # -----------------------------------
        token = extract_token_from_header()
        if not token:
            raise AuthenticationError("Authentication token missing")

        user = get_user_from_token(token)
        if not user:
            raise AuthenticationError("Invalid token")

        instructor = user.name
        today = date.today()

        # -----------------------------------
        # SECURITY: instructor must own batch
        # -----------------------------------
        allowed = frappe.get_all(
            "Course Instructor",
            filters={
                "instructor": instructor,
                "parenttype": "LMS Batch",
                "parent": batch_id
            },
            pluck="parent"
        )

        if not allowed:
            raise AuthenticationError("You are not allowed to view this session")

        # -----------------------------------
        # FETCH BATCH
        # -----------------------------------
        batch = frappe.get_doc("LMS Batch", batch_id)

        st = to_time(batch.start_time)
        et = to_time(batch.end_time)

        duration_minutes = int(
            (
                datetime.combine(today, et) -
                datetime.combine(today, st)
            ).total_seconds() // 60
        )

        # -----------------------------------
        # FETCH LEARNER
        # -----------------------------------
        learner_doc = frappe.get_doc("User", learner)

        # -----------------------------------
        # COURSE PRICE (FINAL)
        # -----------------------------------
        earnings = 0
        if batch.courses:
            course_name = batch.courses[0].course
            course = frappe.get_doc("LMS Course", course_name)
            earnings = course.course_price or 0

        # -----------------------------------
        # DESCRIPTION & NOTES (PLAIN TEXT)
        # -----------------------------------
        clean_details = strip_html(batch.batch_details)

        if batch.custom_topic:
            final_text = f"Topic: {batch.custom_topic}\n\n{clean_details}"
        else:
            final_text = clean_details

        # -----------------------------------
        # FINAL RESPONSE
        # -----------------------------------
        return {
            "status": "success",
            "code": 200,
            "data": {

                # -----------------------------
                # SESSION INFORMATION
                # -----------------------------
                "session_information": {
                    "topic": batch.custom_topic,
                    "date": batch.start_date.strftime("%B %d, %Y"),
                    "time": f"{st.strftime('%I:%M %p')} • {duration_minutes} min",
                    "session_type": "One-on-One Video Call",
                    "earnings": earnings
                },

                # -----------------------------
                # SESSION DETAILS (NO HTML)
                # -----------------------------
                "description": final_text,
                "session_notes": final_text,

                # -----------------------------
                # CONTACT DETAILS
                # -----------------------------
                "contact_details": {
                    "email": learner_doc.email,
                    "phone": learner_doc.phone
                }
            }
        }

    except AuthenticationError as e:
        return {
            "status": "fail",
            "code": 401,
            "message": str(e)
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Session Details API")
        return {
            "status": "fail",
            "code": 500,
            "message": str(e)
        }
import frappe




@frappe.whitelist(allow_guest=False)
def counsellor_details(counsellor: str = None):
    try:
        # ================= AUTH =================
        token = extract_token_from_header()
        if not token:
            raise AuthenticationError("Authentication token missing")

        user = get_user_from_token(token)
        if not user:
            raise AuthenticationError("Invalid token")

        counsellor_id = counsellor or user.name

        # ================= USER DOC =================
        user_doc = frappe.get_doc("User", counsellor_id)

        # ==================================================
        # 1️⃣ AREAS OF EXPERTISE (Skill → Table MultiSelect)
        # ==================================================
        areas_of_expertise = []

        if user_doc.skill:
            for row in user_doc.skill:
                # row is Skills doctype
                if row.skill_name:
                    areas_of_expertise.append(row.skill_name)

        # remove duplicates
        areas_of_expertise = list(set(areas_of_expertise))

        # ==================================================
        # 2️⃣ WORK EXPERIENCE DETAILS (Child Table)
        # ==================================================
        professional_experience = []

        if user_doc.work_experience:
            for exp in user_doc.work_experience:
                professional_experience.append({
                    "designation": exp.title,
                    "company": exp.company,
                    "location": exp.location,
                    "from_date": exp.from_date,
                    "to_date": exp.to_date or "Present"
                })

        # ==================================================
        # 3️⃣ CERTIFICATION DETAILS (Child Table)
        # ==================================================
        certificates = []

        if user_doc.certification:
            for cert in user_doc.certification:
                certificates.append({
                    "certification_name": cert.certification_name,
                    "organization": cert.organization,
                    "issue_date": cert.issue_date,
                    "expiration_date": cert.expiration_date
                })

        # ================= FINAL RESPONSE =================
        return {
            "status": "success",
            "code": 200,
            "data": {
                "profile": {
                    "name": user_doc.full_name,
                    "bio": user_doc.bio or "",
                    "image": user_doc.user_image
                },
                "areas_of_expertise": areas_of_expertise,
                "professional_experience": professional_experience,
                "certificates": certificates
            }
        }

    except AuthenticationError as e:
        return {
            "status": "fail",
            "code": 401,
            "message": str(e)
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Counsellor Details API")
        return {
            "status": "fail",
            "code": 500,
            "message": str(e)
        }


import frappe
import requests

@frappe.whitelist()
def upload_video_to_vimeo(file_url, lesson_name):
    """
    file_url  = LMS uploaded video public URL
    lesson_name = LMS Lesson doc name
    """

    VIMEO_ACCESS_TOKEN = frappe.conf.get("VIMEO_ACCESS_TOKEN")

    if not VIMEO_ACCESS_TOKEN:
        frappe.throw("Vimeo Access Token not configured")

    headers = {
        "Authorization": f"Bearer {VIMEO_ACCESS_TOKEN}",
        "Accept": "application/vnd.vimeo.*+json;version=3.4",
        "Content-Type": "application/json"
    }

    payload = {
        "upload": {
            "approach": "pull",
            "link": file_url
        },
        "privacy": {
            "view": "unlisted"
        }
    }

    response = requests.post(
        "https://api.vimeo.com/me/videos",
        headers=headers,
        json=payload
    )

    if response.status_code not in [200, 201]:
        frappe.throw(response.text)

    data = response.json()
    vimeo_uri = data.get("uri")  # /videos/123456789
    vimeo_id = vimeo_uri.split("/")[-1]

    # Save Vimeo ID in Lesson
    frappe.db.set_value(
        "LMS Lesson",
        lesson_name,
        "vimeo_video_id",
        vimeo_id
    )

    return {
        "status": "success",
        "vimeo_id": vimeo_id
    }

@frappe.whitelist(allow_guest=False)
def get_last_7_days_batches():
    try:
        # ---------------------------
        # Step 1: Token Auth
        token = extract_token_from_header()
        if not token:
            raise AuthenticationError("Token not provided")

        user = get_user_from_token(token)
        if not user:
            raise AuthenticationError("Invalid token")

        roles = frappe.get_roles(user.name)
        if "Instructor" not in roles and "Administrator" not in roles:
            raise PermissionError("Not allowed")

        instructor_value = user.email  # agar name stored ho to user.name

        # ---------------------------
        # Step 2: Date range (today + previous 6 days)
        today = getdate(nowdate())
        start_date = add_days(today, -6)

        # ---------------------------
        # Step 3: Dynamically get child table DocType
        child_doctype = None
        for f in frappe.get_meta("LMS Batch").fields:
            if f.fieldname == "instructors":
                child_doctype = f.options
                break

        if not child_doctype:
            throw("Instructors child table not found in LMS Batch")

        # ---------------------------
        # Step 4: Instructor ke batches
        batch_names = frappe.get_all(
            child_doctype,
            filters={"instructor": instructor_value},
            pluck="parent"
        )

        if not batch_names:
            return {
                "message": {
                    "status": "success",
                    "code": 200,
                    "data": {
                        "today_session_count": 0,
                        "week_session_count": 0,
                        "today_sessions": [],
                        "week_sessions": []
                    }
                }
            }

        # ---------------------------
        # Helper: format response
        def format_batches(rows):
            data = []
            for r in rows:
                duration = None
                if r.start_time and r.end_time:
                    duration = int(
                        (get_datetime(r.end_time) - get_datetime(r.start_time)).total_seconds() / 60
                    )

                data.append({
                    "start_time": format_time(r.start_time),
                    "duration": f"{duration} min" if duration else None,
                    "topic": r.title,
                    "batch_id": r.name
                })
            return data

        # ---------------------------
        # Step 5: Today's batches
        today_batches = frappe.get_all(
            "LMS Batch",
            filters={
                "name": ["in", batch_names],
                "start_date": today,
                "published": 1
            },
            fields=["name", "title", "start_time", "end_time"],
            order_by="start_time asc"
        )

        # ---------------------------
        # Step 6: Last 7 days batches
        week_batches = frappe.get_all(
            "LMS Batch",
            filters={
                "name": ["in", batch_names],
                "start_date": ["between", [start_date, today]],
                "published": 1
            },
            fields=["name", "title", "start_time", "end_time"],
            order_by="start_date asc, start_time asc"
        )

        return {
            "message": {
                "status": "success",
                "code": 200,
                "data": {
                    "today_session_count": len(today_batches),
                    "week_session_count": len(week_batches),
                    "today_sessions": format_batches(today_batches),
                    "week_sessions": format_batches(week_batches)
                }
            }
        }

    except Exception as e:
        return {
            "message": {
                "status": "fail",
                "code": 500,
                "message": str(e)
            }
        }


@frappe.whitelist(allow_guest=False)
def booking_notifications(session_id=None, limit=20):
    try:
        # ---------------------------
        # 1. AUTH
        # ---------------------------
        token = extract_token_from_header()
        if not token:
            frappe.throw("Authorization token missing")

        user = get_user_from_token(token)
        if not user:
            frappe.throw("Invalid or expired token")

        # ---------------------------
        # 2. REQUEST DATA
        # ---------------------------
        if frappe.request and frappe.request.method == "POST":
            data = frappe.request.get_json(silent=True) or {}
            session_id = session_id or data.get("session_id")
            limit = data.get("limit", limit)

        limit = int(limit)

        # ---------------------------
        # 3. ROLE CHECK
        # ---------------------------
        roles = frappe.get_roles(user.name)
        is_admin = "System Manager" in roles or "Administrator" in roles

        # ---------------------------
        # 4. SESSION FILTERS
        # ---------------------------
        session_filters = {}

        if session_id:
            session_filters["name"] = session_id

        # ✅ KEY LINE (FINAL FIX)
        if not is_admin:
            session_filters["counsellor"] = user.name

        # ---------------------------
        # 5. FETCH BOOKINGS
        # ---------------------------
        sessions = frappe.get_all(
            "Counsellor Session",
            filters=session_filters,
            fields=[
                "name",
                "student_name",
                "session_date",
                "start_time",
                "creation"
            ],
            order_by="creation desc",
            limit_page_length=limit
        )

        notifications = []

        for doc in sessions:
            message = (
                f"Session booked with {doc.student_name} on "
                f"{formatdate(doc.session_date)} at "
                f"{format_time(doc.start_time)}"
            )

            seconds = time_diff_in_seconds(
                frappe.utils.now_datetime(),
                doc.creation
            )

            if seconds < 60:
                time_ago = "just now"
            elif seconds < 3600:
                time_ago = f"{int(seconds / 60)} mins ago"
            elif seconds < 86400:
                time_ago = f"{int(seconds / 3600)} hrs ago"
            else:
                time_ago = f"{int(seconds / 86400)} days ago"

            notifications.append({
                "type": "booking",
                "session_id": doc.name,
                "message": message,
                "time_ago": time_ago,
                "created_on": doc.creation
            })

        # ---------------------------
        # 6. RESPONSE
        # ---------------------------
        return {
            "status": "success",
            "code": 200,
            "count": len(notifications),
            "notifications": notifications
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Booking Notification API Error")
        frappe.local.response.http_status_code = 500
        return {
            "status": "fail",
            "message": str(e)
        }




@frappe.whitelist()
def test_api():
    return {"status": "ok"}