# Steps

Each step has a key, a title to rewrite in their words, when it applies, what you do, what they do, and a **Done when** check. A check is a read on the site's data. Never mark a step done on someone's word alone, except where the step says so.

"Setup users" and "agreed" values come from the plan (`plan.md`). "After setup" means after the date the last setup step was marked done. The calls are in `frappe-learning` and its references.

Always in the plan: `basics`, `course-team`, `first-course`, `content`, `learners`, `published`, `learners-started`, `weekly-learning`. Add the rest when the interview turns them on.

## Set up

### `basics`: Your Learning site looks like yours

- **Agree:** the name and logo learners see, whether anyone may sign up, whether people get an email or in-app note when a course is published, and what to do with demo data.
- **Do:** set `Website Settings` `app_name` and `app_logo` (a file they give you). Set `LMS Settings` `disable_signup`, `send_notification_for_published_courses` and `send_notification_for_published_batches`. When they agree, call `lms.lms.api.clear_demo_data`. It is a one-way door.
- **Done when:** `app_name` is the agreed name, the `LMS Settings` fields match what was agreed, and `demo_data_present` is 0 if they chose to remove it.

### `course-team`: Your course team has the right roles

- **Agree:** who builds courses (Course Creator), who grades and runs groups (Batch Evaluator), and who runs the whole site (Moderator).
- **Do:** for people without a user, `lms.lms.api.add_member` with `email`, `first_name`, `last_name`. It emails them. Then `lms.lms.api.save_role` with `user`, `role` and `value` 1, once per role. Show the list first.
- **They do:** each person signs in.
- **Done when:** each agreed person holds the agreed roles (`lms.lms.utils.get_roles`) and their `User` has a `last_login`.

### `first-course`: Your first course has its outline

- **Agree:** the course title (it becomes the course's name), a one-line introduction, a description, the instructors, and the chapters and lesson titles.
- **Do:** create the `LMS Course` with `title`, `short_introduction`, `description` and `instructors`, unpublished. Add chapters with `lms.lms.api.upsert_chapter` and lessons with `lms.lms.api.create_lesson`, titles only.
- **Done when:** `lms.lms.utils.get_course_outline` for the course shows the agreed chapters and lesson titles in the agreed order.

### `content`: Every lesson has its content

- **Do:** turn their material into each lesson's `content` (Editor.js JSON, see `frappe-learning`'s `reference/courses.md`): their text, their files, their video links. Show each lesson's text before you write it. Where their material has a gap, list it for them. This step often takes more than one session; plan it that way.
- **They do:** send the material, and read and approve each lesson.
- **Done when:** every `Course Lesson` of the course has `content` that parses as JSON with at least one block.

### `quizzes`: Your quizzes check what they learned

- **When:** they test learners, and a computer can mark the answers.
- **Do:** from their material, draft `LMS Question` records and an `LMS Quiz` with `title`, `passing_percentage` and `questions`, then add a `quiz` block to the lesson. Show the questions and the right answers first.
- **Done when:** the agreed number of `LMS Quiz` records, each with at least one row in `questions`, each named in a `quiz` block of a lesson in the course.

### `assignments`: Your assignments are ready to grade

- **When:** a person must read the work.
- **Do:** create each `LMS Assignment` with `title`, `question` and `type`, and add an `assignment` block to the lesson. The evaluator must hold Batch Evaluator, or be the course's instructor.
- **Done when:** the agreed `LMS Assignment` records exist, each named in an `assignment` block of a lesson in the course.

### `completion-rules`: Learners finish what you need them to

- **When:** they want learners to finish lessons, videos or quizzes in order.
- **Do:** set `LMS Course` `enforce_lesson_completion` for the course, and the agreed `enforce_*` settings in `LMS Settings`. The settings apply to every course: say so.
- **Done when:** the fields match what was agreed.

### `certificates`: Learners get a certificate when they finish

- **When:** they give certificates.
- **Do:** set `LMS Course` `enable_certification` 1 on the course. Show them the certificate print format (`Print Format` with `doc_type` `LMS Certificate`), and change only its wording, with the `print-formats` skill.
- **Done when:** `enable_certification` is 1 on the course, and a `Print Format` for `LMS Certificate` exists.

### `batch`: Your first group is set up

- **When:** learners go as a group with dates.
- **Agree:** the title, dates and times, timezone, instructors, seats, and whether learners may enroll themselves.
- **Do:** create the `LMS Batch` as `frappe-learning`'s `reference/batches.md` shows, with the course in `courses`, unpublished. Add the courses before any student.
- **Done when:** an `LMS Batch` with the agreed `start_date`, `end_date`, `timezone`, `seat_count` and the course in `courses`.

### `learners`: Your learners are in

- **Agree:** the list of learners: names and emails.
- **Do:** add each new person with `lms.lms.api.add_member`. Then enroll them: into the batch with `lms.lms.api.add_students_to_batch`, or into the course with `lms.lms.api.enroll_students_in_course` (up to 50 at a time). Both email them. Show the list first, and read the `errors` the call returns.
- **Done when:** an `LMS Enrollment` for the course, or an `LMS Batch Enrollment` for the batch, for each agreed learner.

## Start using

The course team and the learners do these. You explain how, then check.

### `published`: Your course is live

- **Done when:** the `LMS Course` has `published` 1, last changed by someone who is not a setup user. With a batch, the `LMS Batch` also has `published` 1.

### `learners-started`: Learners have started

- **Done when:** `LMS Course Progress` rows for the course from at least three learners, or from all of them when there are fewer. Three is a starting guess.

### `first-quiz`: The first quiz is taken

- **When:** `quizzes` is on.
- **Done when:** an `LMS Quiz Submission` for one of the course's quizzes.

### `first-grade`: The first assignment is graded

- **When:** `assignments` is on.
- **Done when:** an `LMS Assignment Submission` for the course with `status` Pass or Fail, changed by someone who is not a setup user.

### `first-certificate`: The first learner has a certificate

- **When:** `certificates` is on.
- **Done when:** an `LMS Certificate` for the course.

## Habit and live

### `weekly-learning`: Learners keep learning

- **Done when:** `LMS Course Progress` rows were made in three different calendar weeks.

### `team-keeps-building`: Your team keeps building

- **When:** they plan more courses or groups.
- **Done when:** course, chapter, lesson, quiz or batch records changed by people who are not setup users in three different calendar weeks.

### `live`: Learning is working, in your words

- **Done when:** their live condition passes on the data, and learners made progress in the last 7 days. Check at 30 and 90 days from the start date.
