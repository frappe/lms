---
name: learning-implementation
description: Set up Frappe Learning (LMS) for a business and see it through to learners who keep learning. Ask who they teach and what material they have, agree a setup plan in their words, set up the site, roles, the first course from their own material, quizzes, a batch, learners and certificates, then check every step on the site's data. Use when someone wants to set up, implement or start using Frappe Learning or LMS, asks what to do next in their Learning setup, or asks whether learners are really using it, when the site runs the Learning app.
---

# Setting up Frappe Learning

This skill takes a business from a fresh Learning site to a published course that learners work through every week. It does not repeat how courses, lessons, batches and roles work: read the `frappe-learning` skill that ships with Learning (`skills/frappe-learning/`, in the site's assistant `lms/frappe-learning`) and its references before you write. That skill shows frappectl commands. Use its doctypes, methods and traps; the calls are the same from any client.

Every step here is a document read or write, or a whitelisted method, so it works the same from the site's assistant, MCP or frappectl. You act as the connected user. Setting up needs the **Moderator** role on a named user. System Manager alone is not enough: the course and batch methods check for Moderator or an instructor row.

Learning has two kinds of users. **The course team** builds courses and runs batches. **Learners** take them. A site is working only when both do their part.

The work has four parts, in this order: **agree the plan**, **set up**, **start using**, **check**. Setting up is your job. Using is theirs: the team publishes and grades, learners learn, and you check that they did.

## Before you start

1. Call `frappe.auth.get_logged_user`, then `lms.lms.utils.get_roles` with `name` set to that user. It answers only a Moderator or Batch Evaluator, so a refusal means neither. Without Moderator, stop and say a Moderator or System Manager must give the role.
2. Look for a plan. List `Note` with `{"title": ["like", "Learning setup plan%"]}`. If one exists, read it and go to "Check where it stands". Do not start a second plan.
3. Read what is already there: `LMS Settings`, `Website Settings` `app_name` and `app_logo`, courses (`lms.lms.utils.get_courses`), `LMS Batch`, and the counts of `LMS Enrollment` and `User`. When `LMS Settings` `demo_data_present` is 1, the site holds a demo course, quiz and four demo users.

## 1. Agree the plan

Ask the questions in `reference/interview.md`. Ask one or two at a time. When the person gives you call notes, take every answer you can from them and ask only for what is missing.

Start with the fit question. When what they need is to track people's HR training records rather than teach courses, say so: that is Frappe HR's job.

Then build the plan from `reference/steps.md`. Every step there says when it applies. Keep the steps that apply, drop the rest, and for each one write:

- the title in their words: "Your Forklift Safety course has its six modules", not "Create LMS Course"
- one line on why, tied to what they said
- who does it: you, them, their team or their learners
- what "done" means on the site's data, from the step's **Done when**

Ask what "Learning is working" looks like for them in a month, and turn the answer into a check you can run on their data, such as "every new hire finishes Onboarding in their first two weeks". If you cannot check it from data, rewrite it with them until you can. This is their live condition.

What they ask for that this skill does not set up goes in the plan under "Asked for, not in this setup", in their words. See "Scope".

**Stop here.** Post the plan, end your turn and wait for their reply. Agree it with them, not with yourself. On a yes, save it as a Note (`reference/plan.md`) so the next session starts where this one ended.

## 2. Set up, one step at a time

Work the setup steps of the plan in order. For each one:

1. Read the records the step touches.
2. Show the change list: for each record, the doctype, the name, each field with its old and new value. Write "new" for a record you will create. For lesson content, show the text.
3. Wait for a yes. Ask even when the chat approves writes on its own: the person must see each change to their site before it is made.
4. Write, ten records or fewer at a time.
5. Run the step's **Done when** check. Say whether it passed, and what the data showed.
6. On a pass, mark the step done in the plan (show that edit too), and name the next step.

Warn before a change that is hard to undo. These are listed in "One-way doors".

**Course content comes only from their material.** Turn their slides, documents, videos and notes into lessons and questions. Never write teaching content from your own knowledge of the subject, even when asked "just fill it in": the course teaches what their business does, and only they know that. Where their material has a gap, list the gap and ask.

## 3. Start using

From here the steps belong to them. The course team publishes the course and grades; learners study and take quizzes. **Never publish a course, enroll yourself, take a quiz, mark progress or issue a certificate on their behalf.** A record you made proves nothing about whether they use Learning. Explain how to do it in the app, then check that it happened.

A record counts for a use step when it was made after setup by someone who is not a setup user. The plan lists the setup users: an implementer or partner who set up the site for them. When the business set itself up, the list is empty and every record after setup counts.

## 4. Check where it stands

When they ask "where are we", "what's next" or "is it working", run the **Done when** check of every step in the plan. Reads only. For a course's progress, `lms.lms.api.get_course_progress_distribution` with `course` answers in one call. Then answer in three lines: what is done, what is next, the one thing to do now. Under that, a short table: step, done or not, what the data shows.

They are **live** when their live condition holds and their learners made progress in the last 7 days. Check it again 30 and 90 days after the plan's start date. Live at day 90 is the goal; setup is not.

Offer, at the end of every session, to add three lines to the plan's log: what was done, what failed, what is next.

## Scope

This skill sets up standard Learning: branding and site settings, roles, free courses with chapters and lessons, quizzes and assignments, completion rules, batches, learners and enrollments, certificates of completion.

It does not set up paid courses or batches and payment gateways, Zoom or Google Meet live classes, programming exercises, SCORM packages, the jobs board, custom signup pages, custom fields or integrations. `frappe-learning` covers several of these once the site is live. Note each ask in the plan and say it is not part of this setup.

## One-way doors

Ask before each of these, and say what will happen:

1. **Publishing.** A published course is visible to learners. When `LMS Settings` `send_notification_for_published_courses` is Email or In-app, every enabled user is told the same day. Batches notify as soon as they are published. Leave publishing to them.
2. **Adding members and enrolling learners.** `lms.lms.api.add_member` makes a user, which emails them a welcome link. Batch enrollment emails a confirmation. Show the list first.
3. **Titles.** A course or batch name is a slug of its first title, and links use it. Agree the title before you create it.
4. **Removing demo data.** `lms.lms.api.clear_demo_data` deletes the demo course, its quiz and the four demo users for good.
5. **Deleting a course, chapter or lesson.** It takes enrollments, progress and certificates with it. See `frappe-learning`'s traps.

Everything else can be changed back, so do it after the change list and a yes.

## When a call fails

An error that names its cause has a fix in the traps below or in `frappe-learning`. For an error with no cause:

1. Run the call once more. Change only what could matter.
2. Make it smaller until you find the smallest call that still fails.
3. Stop and give the person the exact call and the exact error.

Never work around a permission error. Say which role the step needs.

## Traps

- **Learners are not desk users.** Add them as members and enroll them. Never give them a desk role to "let them in".
- **Build structure with the app's methods.** `lms.lms.api.upsert_chapter` and `create_lesson` keep the chapter and lesson order right. A plain insert breaks it.
- **Lesson content is an Editor.js JSON string.** Text that is not valid JSON saves with no error and the lesson cannot show. Read every lesson back after you write it.
- **Learners skip a quiz that has no questions.** Publishing only warns about it. Add the questions before the course goes out.
- **Completion rules apply to the whole site.** The `enforce_*` settings in `LMS Settings` (finish the video, pass the quiz) change progress for every course. Agree them before learners start.
- **A course added to a batch later does not enroll the students already in it.** Add the courses first, then the students.
- **Read in pages.** Ask for 100 rows or fewer at a time. For counts, count; do not list.

## Reference

- `reference/interview.md`: the questions, in order, and what each answer decides.
- `reference/steps.md`: every step, when it applies, what you do, what they do, and its Done when check.
- `reference/plan.md`: how to write the plan as a Note on the site.
