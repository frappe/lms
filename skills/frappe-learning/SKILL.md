---
name: frappe-learning
description: Manage a Frappe Learning (LMS) site from outside the app, through frappectl. Use to create or edit courses, chapters, lessons and programs, write lesson content, quizzes, assignments and programming exercises, read and grade submissions, enroll learners, run batches and live classes, issue certificates, read payments and make coupons, or manage members and their Learning roles, when the site runs the Learning app.
---

# Frappe Learning

A Learning site is a set of documents. A course (`LMS Course`) has chapters (`Course Chapter`), and each chapter has lessons (`Course Lesson`). A learner joins a course through an `LMS Enrollment`, and each finished lesson adds an `LMS Course Progress` row. A batch (`LMS Batch`) is a cohort with dates, courses, students (`LMS Batch Enrollment`) and live classes (`LMS Live Class`). A program (`LMS Program`) is an ordered set of courses.

A lesson can hold three kinds of assessment, and each attempt saves a submission:

| Assessment | Submission |
|---|---|
| `LMS Quiz`, made of `LMS Question` rows | `LMS Quiz Submission`, with the score and the result |
| `LMS Assignment` | `LMS Assignment Submission`, with the answer or file, a status and the evaluator's comments |
| `LMS Programming Exercise` | `LMS Programming Exercise Submission`, with the code and the test case results |

A learner can ask for an evaluation (`LMS Certificate Request`), and the evaluator records it (`LMS Certificate Evaluation`). A certificate (`LMS Certificate`) is issued for a course or a batch.

A paid course or batch records each payment in an `LMS Payment`: the member, the amount and currency, the document paid for, any `LMS Coupon` used, and whether the payment came in.

Read and change these documents with `frappectl`. Use the app's own methods where this file names one, because they keep chapter and lesson order, permissions and progress correct. Use plain document calls for the rest.

## 1. Connect

Ask the human for a frappectl profile with write access, and pass it as `-s <p>`. Check it with `frappectl -s <p> method call lms.lms.utils.get_courses -F 'filters:={"created":1}'`, which any signed-in user can call. A Moderator or Batch Evaluator can also read the user's Learning roles with `method call lms.lms.utils.get_roles -F name=<user>`.

The user needs a Learning role:

- **Moderator** manages everything: all courses, batches, members and roles.
- **Course Creator** makes courses and edits only the courses where they are an instructor. They cannot make batches.
- **Batch Evaluator** makes batches, adds students, and records evaluations and certificates for the courses they evaluate.
- **LMS Student** is the role every new user gets. A student reads published content, enrolls themselves, and takes quizzes, assignments and exercises. Methods that act only for the signed-in user, such as `enroll_in_batch` and `mark_lesson_progress`, work only when the frappectl profile is the student's own.

System Manager alone is not enough. The course and batch methods check for the Moderator role or an instructor row, not for System Manager. Administrator counts as a Moderator only when it has the Moderator role, so work as a named user.

The Learning roles give no desk access, so most Learning users are not System Users. When the site sets `block_endpoints`, such a user can still make every `method call` to `lms.` methods and to `frappe.client.get`, `get_list`, `insert`, `set_value` and `delete`. Learning refuses their `doc` commands and `auth whoami`. Use those `frappe.client` methods in place of `doc` commands, or ask the human to give the user a desk role, such as Desk User.

- `frappectl doc create` and `doc update` read stdin when it is not a terminal, and hang in an agent's shell. Pass `--input <file>`, or `< /dev/null` with `--set`.
- Send dict and list arguments as JSON: `-F 'filters:={"published":1}'`.

## 2. Look before you change

```sh
L=lms.lms.utils
frappectl -s <p> method call $L.get_courses -F 'filters:={"created":1}'          # courses where you are an instructor
frappectl -s <p> method call $L.get_course_outline -F course=<course>             # chapters and lessons, no content
frappectl -s <p> doc get "Course Lesson" "<lesson name>"                          # one lesson with its content
frappectl -s <p> method call $L.get_batch_details -F batch=<batch>                # courses, instructors, student count, seats left
```

Lists such as `lms.lms.api.get_created_courses` return a few rows at a time (3 for that one). Pass `-F start=<n>` and `-F limit_page_length=<n>` (up to 120) for more. A Moderator who instructs no course gets every course from `get_created_courses`.

Names come from titles. A course or batch name is a slug of its title. A chapter or lesson name is `<4 digits> <title>`. A program name is its title. Find a name with a list call. Do not build it yourself.

## 3. Common tasks

| Task | Call |
|---|---|
| New course | `doc create "LMS Course"` with `title`, `short_introduction`, `description` (HTML) and `instructors` `[{"instructor": "<user>"}]` |
| Add a chapter | `method call lms.lms.api.upsert_chapter -F course=<c> -F title=<t>` |
| Add a lesson | `method call lms.lms.api.create_lesson -F chapter=<chapter name> -F title=<t> -F 'content:=<Editor.js JSON>'` |
| Reorder | `method call lms.lms.api.update_chapter_index -F chapter=<ch> -F course=<c> -F idx=<n>`, or `update_lesson_index -F lesson=<l> -F sourceChapter=<ch> -F targetChapter=<ch> -F idx=<n>` to move a lesson, also to another chapter. `idx` counts from 0. |
| Publish a course | `doc update "LMS Course" <c> --set published=1` |
| Enroll a learner | `doc create "LMS Enrollment" --set course=<c> --set member=<user>` |
| Course progress | `method call lms.lms.api.get_course_progress_distribution -F course=<c>` |
| New batch | `doc create "LMS Batch"`. See `reference/batches.md`. |
| Add students to a batch | `method call lms.lms.api.add_students_to_batch -F batch=<b> -F 'members:=["<user>", ...]'`. It also enrolls them in each batch course, and lists the ones it could not add. |
| Make a quiz, assignment or exercise | `doc create "LMS Quiz"`, `"LMS Assignment"` or `"LMS Programming Exercise"`, then add its block to a lesson. See `reference/courses.md`. |
| Read submissions | `doc list "LMS Quiz Submission" -f quiz=<q>`. Also `"LMS Assignment Submission"` (`-f assignment=<a>`) and `"LMS Programming Exercise Submission"` (`-f exercise=<e>`). Add `-f member=<user>` for one learner. |
| Grade an assignment | `doc update "LMS Assignment Submission" <name> --set status=Pass --set comments="<feedback>" < /dev/null`. `status` is `Pass`, `Fail`, `Not Graded` or `Not Applicable`. |
| Read payments | `doc list "LMS Payment" -f payment_for_document=<course or batch> -f payment_received=1`. Each row has the member, amount, currency and any coupon. |
| Make a coupon | `doc create "LMS Coupon"` with `code`, `discount_type` (`Percentage` or `Fixed Amount`), `percentage_discount` or `fixed_amount_discount`, `applicable_items` `[{"reference_doctype": "LMS Course", "reference_name": "<c>"}]`, and optional `expires_on` and `usage_limit` |
| Price after a coupon | `method call lms.lms.utils.get_order_summary -F doctype="LMS Course" -F docname=<c> -F coupon=<code> -F country=<country>`. It refuses a free course or batch. |
| Export a course | `method call lms.lms.api.export_course_as_file -F course_name=<c>` returns the link of a private ZIP that only you can open |
| Issue a certificate | `method call lms.lms.api.save_certificate_details` (one learner) or `generate_batch_certificates` (a batch). Needs a Moderator or the course's assigned evaluator. |
| Add a member | `method call lms.lms.api.add_member -F email=<e> -F first_name=<n>` |
| Give or remove a role | `method call lms.lms.api.save_role -F user=<u> -F role="Course Creator" -F value:=1` |

Courses, programs, lesson content, quizzes, assignments and exercises: `reference/courses.md`. Batches, live classes and certificates: `reference/batches.md`. Members and roles: `reference/people.md`.

Open-ended quiz answers cannot be graded over the API: the Learning roles can read `LMS Quiz Submission` but not change it. Ask the human to grade them in the app.

Several methods act only for the signed-in user: `enroll_in_batch`, `enroll_in_program`, `mark_lesson_progress` and `create_certificate`. To act for a learner, use the document calls in the table.

## 4. Traps

- **Deletes cannot be undone.** There is no trash and no prompt. Ask the human first, and name what will go:
  - `delete_course` removes its chapters, lessons, enrollments, progress, evaluations, certificates, reviews and discussions. It keeps its quizzes, assignments and their submissions, and clears their link to the course.
  - `delete_chapter` removes its lessons, their progress and their discussions.
  - `delete_batch` removes its student list, timetable, feedback and discussions. It keeps the batch certificates and the students' course enrollments.
- **Publishing can notify everyone.** When the site's notification setting is Email or In-app, every enabled user gets an email or an in-app notification. A batch sends it as soon as it is published. A course sends it in the daily job, for the courses published that day. Clearing `upcoming` on a course emails each user who asked to be told. Ask before you publish.
- **Lesson content is an Editor.js JSON string.** Text that is not valid JSON is saved with no error, and the lesson page cannot show it.
- **Positions count two ways.** Reorder calls count from 0. Lesson numbers such as `1-2` (chapter 1, lesson 2) count from 1.
- **A batch does not follow its courses.** A course added to a batch later does not enroll the students already there. Removing a student from a batch leaves their course enrollments.
- **Some calls are rate-limited.** `get_courses` and `get_batch_details` allow 500 calls an hour. Ask for bigger pages instead of looping over one page at a time.

## Reference

- `reference/courses.md`: course structure, lesson content blocks, quizzes, assignments, programming exercises and programs.
- `reference/batches.md`: batch fields, students, live classes, evaluations and certificates.
- `reference/people.md`: members, Learning roles and what each one can do.
