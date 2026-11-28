---
name: learning-pages
description: Use whenever you mention, link, create or change a Frappe Learning (LMS) record (course, chapter, lesson, batch, program, quiz, assignment, programming exercise, submission, enrollment, live class, job opening or member). The user works in the Learning app at /lms, so link each record to its Learning page, not to /desk, and say which page shows the change.
---

# Learning pages

The user works in the Learning app, whose pages start with `/lms`, and Flow's chat sits beside the page they have open. Link every Learning record to its Learning page, so it opens in the app beside the chat. A `/desk/...` link takes them out of the app. Keep the Desk link only for a doctype that has no row below.

Put the record's name in the link as it is, with spaces as `%20`. When a page needs a field of the record, such as a lesson's `course`, read the record first.

## Where each record opens

| DocType | Link |
|---|---|
| LMS Course | `/lms/courses/<name>` |
| Course Chapter | `/lms/courses/<course>/chapter/<name>` |
| Course Lesson | `/lms/courses/<course>?editLessonName=<name>#editor`, the lesson in the course editor |
| LMS Enrollment | `/lms/courses/<course>#dashboard` |
| LMS Batch | `/lms/batches/<name>` |
| LMS Batch Enrollment | `/lms/batches/<batch>#dashboard` |
| LMS Live Class | `/lms/batches/<batch_name>#classes` |
| LMS Program | `/lms/programs/<name>/edit` for a Moderator or Course Creator, `/lms/programs/<name>` for a member |
| LMS Quiz | `/lms/quizzes/edit/<name>` |
| LMS Quiz Submission | `/lms/quiz-submission/<name>` |
| LMS Assignment | `/lms/assignments/edit/<name>` |
| LMS Assignment Submission | `/lms/assignment-submission/<assignment>/<name>` |
| LMS Programming Exercise | `/lms/programming-exercises/edit/<name>` |
| LMS Programming Exercise Submission | `/lms/programming-exercise-submission/<exercise>/<name>` |
| Job Opportunity | `/lms/job-openings/<name>` |
| User | `/lms/user/<username>`, with the user's `username`, not their email |

A learner reads a lesson at `/lms/courses/<course>/learn/<number>`, where `<number>` is the lesson's `number` (such as `2-3`) in `lms.lms.utils.get_course_outline` for the course. Link that page only when the user asks for the learner's view.

## Lists

| What | Link |
|---|---|
| Courses | `/lms/courses` |
| Batches | `/lms/batches` |
| Programs | `/lms/programs` |
| Quizzes, and their submissions | `/lms/quizzes`, `/lms/quizzes/submissions` |
| Assignments, and their submissions | `/lms/assignments`, `/lms/assignments/submissions` |
| Programming exercises, and their submissions | `/lms/programming-exercises`, `/lms/programming-exercises/submissions` |
| Certified members | `/lms/certified-participants` |
| Job openings | `/lms/job-openings` |

## After a change

When you create or change a record, end with the link to the page that shows it and name that page, for example: "The new lesson is in the course editor: [Variables](/lms/courses/python-basics?editLessonName=0042%20Variables#editor)." Name the tab when the change is on one: the course's Content tab (`#editor`) for chapters and lessons, the Dashboard tab for enrollments, a batch's Classes tab for live classes.

When `read_screen` shows the user already has that page open, say so: the page refreshes by itself when you save. If they have unsaved edits there, the page keeps them and offers Load changes instead.
