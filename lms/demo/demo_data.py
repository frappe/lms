import json

import frappe

from lms.lms.doctype.lms_course.lms_course import update_course_statistics
from lms.lms.utils import get_course_progress


def create_demo_data(args: dict = None):
	course = create_course()
	student = create_user("Ashley", "Ippolito", "ash@ipp.com", "/assets/lms/images/student.jpg")
	student1 = create_user("John", "Doe", "john.doe@example.com", "/assets/lms/images/student1.jpeg")
	student2 = create_user("Jane", "Smith", "jane.smith@example.com", "/assets/lms/images/student2.jpeg")
	create_chapter(course)
	create_lessons(course)
	enroll_student_in_course(student, course)
	enroll_student_in_course(student1, course)
	enroll_student_in_course(student2, course)
	create_reviews(course, student)
	create_progress(course, student, 3)
	create_progress(course, student1, 2)
	create_progress(course, student2, 4)
	frappe.db.set_single_value("LMS Settings", "demo_data_present", 1)


def create_course():
	title = "A guide to Frappe Learning"
	filters = {"title": title}
	if frappe.db.exists("LMS Course", filters):
		return frappe.get_doc("LMS Course", filters)

	instructor = create_instructor()
	course = frappe.new_doc("LMS Course")
	course.update(
		{
			"title": title,
			"category": "Business",
			"tags": "Frappe, Demo",
			"published": 1,
			"published_on": frappe.utils.now(),
			"video_link": "VIt_bsbBjLI",
			"instructors": [{"instructor": instructor.name}],
			"short_introduction": "Learn the basics of Frappe Learning and how to get started with your very first course.",
			"image": "/assets/lms/images/course_card.jpeg",
		}
	)

	course.description = """
		This course will cover the fundamentals of Frappe Learning, including how to create and manage courses, enroll students, and track progress. You will learn about the following key features of the app:
		<br>
		<h3>Key Features</h3>
		<br>
		1. Structured Learning: Design a course with a 3-level hierarchy, where your courses have chapters, and you can group your lessons within these chapters. This ensures that the context of each lesson is clearly defined by its chapter.
		<br>
		<br>
		2. Live Classes: Group learners into batches based on courses and duration. You can then create Zoom live classes for these batches directly from the app. Learners can view all the live classes they need to attend as part of their batch.
		<br>
		<br>
		3. Quizzes and Assignments: Create quizzes with single-choice, multiple-choice, or open-ended questions. Instructors can also add assignments that learners can submit as PDFs or documents.
		<br>
		<br>
		4. Getting Certified: Once a learner completes the course or batch, you can grant them a certificate. The app provides an inbuilt certificate template that you can use as-is or customize by creating your own template.
		<br>
		<br>
		To know more about the app and its features, <a href="https://docs.frappe.io/learning">check out the documentation</a>.
 """
	course.save()
	return course


def create_instructor():
	if (
		frappe.db.count(
			"User",
			{
				"name": ["not in", ("Administrator", "Guest")],
			},
		)
		> 0
	):
		user = frappe.get_all(
			"User",
			{
				"name": ["not in", ("Administrator", "Guest")],
			},
			pluck="name",
			limit=1,
		)[0]
		return frappe.get_doc("User", user)

	return create_user("Jannat", "Patel", "jannat@example.com", "/assets/lms/images/instructor.png")


def create_user(first_name, last_name, email, user_image):
	filters = {"first_name": first_name, "last_name": last_name, "email": email}
	if frappe.db.exists("User", filters):
		return frappe.get_doc("User", filters)

	user = frappe.new_doc("User")
	user.first_name = first_name
	user.last_name = last_name
	user.user_image = user_image
	user.email = email
	user.save()
	return user


def create_chapter(course):
	prepare_chapter(course, "Introduction")
	prepare_chapter(course, "Adding content to your lessons")
	prepare_chapter(course, "Assessments")


def prepare_chapter(course, chapter_title):
	chapter_exists = check_if_chapter_exists(course, chapter_title)
	if chapter_exists:
		return frappe.get_doc("Course Chapter", chapter_exists)

	chapter1 = frappe.new_doc("Course Chapter")
	chapter1.course = course.name
	chapter1.title = chapter_title
	chapter1.save()
	add_chapter_to_course(course, chapter1)


def check_if_chapter_exists(course, chapter_title):
	filters = {"course": course.name, "title": chapter_title}
	return frappe.db.exists("Course Chapter", filters)


def add_chapter_to_course(course, chapter):
	course.reload()
	course.append("chapters", {"chapter": chapter.name})
	course.save()


def create_lessons(course):
	create_intro_lesson_1(course)
	create_intro_lesson_2(course)
	create_content_lesson_1(course)
	create_content_lesson_2(course)
	create_assessment_lesson_1(course)


def get_chapter(course, chapter_title):
	filters = {"course": course.name, "title": chapter_title}
	return frappe.get_doc("Course Chapter", filters)


def create_lesson(course, chapter, title, content):
	filters = {"course": course.name, "chapter": chapter.name, "title": title}

	if frappe.db.exists("Course Lesson", filters):
		return frappe.get_doc("Course Lesson", filters)

	lesson = frappe.new_doc("Course Lesson")
	lesson.course = course.name
	lesson.chapter = chapter.name
	lesson.title = title
	lesson.content = content
	lesson.save()
	add_lesson_to_chapter(chapter, lesson)


def add_lesson_to_chapter(chapter, lesson):
	chapter.reload()
	chapter.append("lessons", {"lesson": lesson.name})
	chapter.save()


def create_intro_lesson_1(course):
	title = "What is a Learning Management System?"
	chapter = get_chapter(course, "Introduction")
	content = """
		{"time":1772449622100,"blocks":[{"id":"vYTdcXYVgI","type":"embed","data":{"service":"youtube","source":"http://youtube.com/watch?v=SauviPVDItU","embed":"SauviPVDItU","caption":""}}],"version":"2.29.0"}
	"""
	create_lesson(course, chapter, title, content)


def create_intro_lesson_2(course):
	title = "What is Frappe Learning?"
	chapter = get_chapter(course, "Introduction")
	content = """
		{"time":1772449622100,"blocks":[{"id":"vYTdcXYVgI","type":"embed","data":{"service":"youtube","source":"http://youtube.com/watch?v=SauviPVDItU","embed":"SauviPVDItU","caption":""}}],"version":"2.29.0"}
	"""
	create_lesson(course, chapter, title, content)


def create_content_lesson_1(course):
	title = "Video Content"
	chapter = get_chapter(course, "Adding content to your lessons")
	content = json.dumps(get_video_content())
	create_lesson(course, chapter, title, content)


def create_content_lesson_2(course):
	title = "Content from Google Suite"
	chapter = get_chapter(course, "Adding content to your lessons")
	content = json.dumps(get_google_suite_content())
	create_lesson(course, chapter, title, content)


def create_assessment_lesson_1(course):
	quiz = create_quiz()
	title = "Quiz Time"
	chapter = get_chapter(course, "Assessments")
	content = f"""{{
		"time": 1770118649591,
		"blocks": [
			{{
				"id": "3xqARGZqQa",
				"type": "quiz",
				"data": {{ "quiz": "{quiz.name}" }}
			}}
		],
		"version": "2.29.0"
	}}"""
	create_lesson(course, chapter, title, content)


def create_quiz():
	title = "Do you know Frappe Learning?"
	filters = {"title": title}
	if frappe.db.exists("LMS Quiz", filters):
		return frappe.get_doc("LMS Quiz", filters)

	questions = []
	questions.append(
		create_quiz_questions(
			"What is Frappe Learning primarily used for?",
			"Project Management",
			False,
			"Learning Management",
			True,
		)
	)
	questions.append(
		create_quiz_questions(
			"Which of the following can be added to a course in Frappe Learning?",
			"Lessons",
			True,
			"Issues",
			False,
		)
	)
	questions.append(
		create_quiz_questions(
			"What is the top-level structure in Frappe Learning?", "Chapter", False, "Course", True
		)
	)
	questions.append(
		create_quiz_questions("Can you create quizzes in Frappe Learning?", "Yes", True, "No", False)
	)
	questions.append(
		create_quiz_questions(
			"Which of the following content can be added to lessons?", "Bugs", False, "Videos", True
		)
	)
	questions.append(
		create_quiz_questions("Can you track learner progress in Frappe Learning?", "Yes", True, "No", False)
	)
	questions.append(
		create_quiz_questions(
			"What is the purpose of a batch in Frappe Learning?",
			"To group learners",
			True,
			"To store website themes",
			False,
		)
	)
	questions.append(
		create_quiz_questions(
			"How can you create custom certificates in Frappe Learning?",
			"Using Server Scripts",
			False,
			"Using Print Formats",
			True,
		)
	)
	quiz = frappe.new_doc("LMS Quiz")
	quiz.update(
		{
			"title": title,
			"passing_percentage": 70,
			"total_marks": 40,
		}
	)
	for question in questions:
		quiz.append(
			"questions",
			{
				"question": question.name,
				"marks": 5,
			},
		)
	quiz.save()
	return quiz


def create_quiz_questions(question, option_1, is_correct_1, option_2, is_correct_2):
	doc = frappe.new_doc("LMS Question")
	doc.update(
		{
			"question": question,
			"type": "Choices",
			"option_1": option_1,
			"is_correct_1": is_correct_1,
			"option_2": option_2,
			"is_correct_2": is_correct_2,
		}
	)
	doc.save()
	return doc


def create_reviews(course, student):
	frappe.session.user = student.name
	review = frappe.new_doc("LMS Course Review")
	review.course = course.name
	review.rating = 0.8
	review.review = "This is a great course to get started with Frappe Learning. The content is well-structured and easy to follow."
	review.save()
	frappe.session.user = "Administrator"
	update_course_statistics()


def enroll_student_in_course(student, course):
	filters = {"member": student.name, "course": course.name}
	if not frappe.db.exists("LMS Enrollment", filters):
		enrollment = frappe.new_doc("LMS Enrollment")
		enrollment.member = student.name
		enrollment.course = course.name
		enrollment.save()


def create_progress(course, student, limit=None):
	lessons = frappe.get_all(
		"Course Lesson", {"course": course.name}, pluck="name", limit=limit, order_by="creation asc"
	)
	for lesson in lessons:
		filters = {"member": student.name, "lesson": lesson, "course": course.name}
		if not frappe.db.exists("LMS Course Progress", filters):
			progress = frappe.new_doc("LMS Course Progress")
			progress.member = student.name
			progress.lesson = lesson
			progress.course = course.name
			progress.status = "Complete"
			progress.save()

	progress = get_course_progress(course.name, student.name)
	frappe.db.set_value(
		"LMS Enrollment", {"member": student.name, "course": course.name}, "progress", progress
	)


def get_video_content():
	return {
		"time": 1772450228627,
		"blocks": [
			{
				"id": "bj6mK0D36z",
				"type": "paragraph",
				"data": {
					"text": "Frappe Learning allows you to embed videos in lessons using popular video hosting platforms."
				},
			},
			{
				"id": "1ooWPn5Zmq",
				"type": "paragraph",
				"data": {
					"text": "You don't need to upload videos directly into Frappe Learning - simply copy the video URL from your preferred provider and paste it into the Lesson Editor."
				},
			},
			{
				"id": "tCJD0yMAGd",
				"type": "paragraph",
				"data": {
					"text": "Frappe Learning automatically detects the video source and embeds it for learners."
				},
			},
			{"id": "KpfuszbA09", "type": "markdown", "data": {"text": ""}},
			{"id": "PZYmdlzQj2", "type": "header", "data": {"text": "YouTube", "level": 2}},
			{
				"id": "mJsIbQSHYO",
				"type": "paragraph",
				"data": {"text": "YouTube videos can be embedded using the standard watch URL."},
			},
			{"id": "-H8fLBsAMk", "type": "paragraph", "data": {"text": "<b>Supported URL format</b>"}},
			{
				"id": "Aiq-BfQkwZ",
				"type": "paragraph",
				"data": {
					"text": '<code class="inline-code">https://www.youtube.com/watch?v=&lt;video-id&gt;</code>'
				},
			},
			{"id": "8hMi323AbM", "type": "paragraph", "data": {"text": "<b>Example</b>"}},
			{
				"id": "3H6BzIshWg",
				"type": "paragraph",
				"data": {
					"text": '<code class="inline-code">https://www.youtube.com/watch?v=SLNSSz41v_o</code>'
				},
			},
			{"id": "yGSuw7Im0i", "type": "markdown", "data": {"text": ""}},
			{"id": "WRVOABPAZO", "type": "header", "data": {"text": "Vimeo", "level": 2}},
			{
				"id": "AabHQjaQvo",
				"type": "paragraph",
				"data": {"text": "Vimeo videos are supported using the video URL."},
			},
			{"id": "q_9aNfNHEP", "type": "paragraph", "data": {"text": "<b>Supported URL format</b>"}},
			{
				"id": "1YYctmoyod",
				"type": "paragraph",
				"data": {"text": '<code class="inline-code">https://vimeo.com/&lt;video-id&gt;</code>'},
			},
			{"id": "OX_NGBxJTY", "type": "paragraph", "data": {"text": "<b>Example</b>"}},
			{
				"id": "KZYnrs_Dnf",
				"type": "paragraph",
				"data": {"text": '<code class="inline-code">https://vimeo.com/825334862</code>'},
			},
			{"id": "-mkC711EdF", "type": "markdown", "data": {"text": ""}},
			{"id": "nSzyGY6f68", "type": "header", "data": {"text": "Cloudflare Stream", "level": 2}},
			{
				"id": "-cpNtfvP5T",
				"type": "paragraph",
				"data": {"text": "Cloudflare Stream provides secure video hosting with adaptive streaming."},
			},
			{"id": "e2fQ-DG6Nd", "type": "paragraph", "data": {"text": "<b>Supported URL format</b>"}},
			{
				"id": "av_Q4P66hb",
				"type": "paragraph",
				"data": {
					"text": '<code class="inline-code">https://customer-&lt;account-id&gt;.cloudflarestream.com/&lt;video-id&gt;/watch</code>'
				},
			},
			{"id": "8KCsx40NpJ", "type": "paragraph", "data": {"text": "<b>Example</b>"}},
			{
				"id": "USi0pW91df",
				"type": "paragraph",
				"data": {
					"text": '<code class="inline-code">https://customer-f33zs165nr7gyfy4.cloudflarestream.com/6b9e68b07dfee8cc2d116e4c51d6a957/watch</code>'
				},
			},
			{"id": "e6I0VuwXx9", "type": "markdown", "data": {"text": ""}},
			{"id": "C-u44GnaTz", "type": "header", "data": {"text": "Bunny Stream", "level": 2}},
			{
				"id": "uR8XZtPVC5",
				"type": "paragraph",
				"data": {"text": "Bunny Stream allows fast, global video delivery with built-in analytics."},
			},
			{"id": "BYkm4Hy_v8", "type": "paragraph", "data": {"text": "<b>Supported URL format</b>"}},
			{
				"id": "TCM9COabp8",
				"type": "paragraph",
				"data": {
					"text": '<code class="inline-code">https://iframe.mediadelivery.net/play/&lt;library-id&gt;/&lt;video-id&gt;</code>'
				},
			},
			{"id": "KCiA6zVRYf", "type": "paragraph", "data": {"text": "<b>Example</b>"}},
			{
				"id": "kYDFL8Dn1v",
				"type": "paragraph",
				"data": {
					"text": '<code class="inline-code">https://iframe.mediadelivery.net/play/579970/54b3e5a1-cf95-4f88-96d3-8387d93dc2f2</code>'
				},
			},
			{"id": "jfnSgNAv5Q", "type": "markdown", "data": {"text": ""}},
			{"id": "NCY3opj8uc", "type": "header", "data": {"text": "Important Notes", "level": 2}},
			{
				"id": "xHWE56ECqw",
				"type": "paragraph",
				"data": {"text": "Paste only the video URL, not iframe embed code"},
			},
			{
				"id": "ZzrV99rSxJ",
				"type": "paragraph",
				"data": {"text": "The URL must match one of the supported formats above"},
			},
			{
				"id": "jjg_inGE2B",
				"type": "paragraph",
				"data": {
					"text": "Video privacy, access control, and streaming limits are managed by the video provider"
				},
			},
		],
		"version": "2.29.0",
	}


def get_google_suite_content():
	return {
		"time": 1772450743148,
		"blocks": [
			{
				"id": "73fFo3DS18",
				"type": "paragraph",
				"data": {
					"text": "You can integrate live Google Docs, Sheets, and Slides into your lessons to provide dynamic, up-to-date documentation and presentations."
				},
			},
			{"id": "Z6I1ZV7Fvr", "type": "markdown", "data": {"text": ""}},
			{
				"id": "hiJVoYEhfN",
				"type": "header",
				"data": {"text": "How to Embed Google Workspace Files", "level": 3},
			},
			{
				"id": "v9_hXM3d8b",
				"type": "list",
				"data": {
					"style": "ordered",
					"items": [
						{"content": "Open your Google Doc, Sheet, or Slide.", "items": []},
						{"content": "Make sure your permissions are set properly", "items": []},
						{"content": "Copy your URL from the top browser address bar", "items": []},
						{"content": "Now paste it in your lesson", "items": []},
					],
				},
			},
			{"id": "ycS1sd-0us", "type": "markdown", "data": {"text": ""}},
			{"id": "NjN6_ixXRW", "type": "header", "data": {"text": "Integration Options", "level": 3}},
			{
				"id": "MgXDT0xV4X",
				"type": "list",
				"data": {
					"style": "unordered",
					"items": [
						{
							"content": "Google Slides:&nbsp;Perfect for presentations. These render with full navigation controls for the student.",
							"items": [],
						},
						{
							"content": "Google Sheets:&nbsp;Useful for sharing live data tables or interactive calculators.",
							"items": [],
						},
						{
							"content": "Google Docs:&nbsp;Best for course handouts, reading material, or live-updating documentation.",
							"items": [],
						},
					],
				},
			},
		],
		"version": "2.29.0",
	}
