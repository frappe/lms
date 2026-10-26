# Batches, live classes and certificates

## Make a batch

Make a batch with `doc create "LMS Batch" --input <file>`. It needs these fields:

- `title`, `description` (one or two lines) and `batch_details` (HTML)
- `start_date`, `end_date`, `start_time` and `end_time`
- `timezone`, an IANA name such as `Asia/Kolkata`. The dates and times are in this timezone.
- `instructors` `[{"instructor": "<user>"}]`

Add courses with `courses` `[{"course": "<course>", "evaluator": "<user>"}]`. The evaluator is set for each course, and it is optional. It must be a user with the Batch Evaluator role, because it links to their evaluator record. Other fields you often need: `seat_count`, `published`, `allow_self_enrollment`, `paid_batch` with `amount` and `currency`.

Learning refuses a batch whose end is before its start, a course or instructor listed twice, or a seat count below the students already in it.

A Course Creator cannot make a batch. A Moderator or a Batch Evaluator can.

## Students

Add students with `method call lms.lms.api.add_students_to_batch -F batch=<b> -F 'members:=["<user>", "<user>"]'`. For each student, Learning does these things:

1. It checks the seats left.
2. It enrolls the student in each course of the batch.
3. It emails the student a confirmation, if the site sends email.
4. It invites the student to the batch's upcoming live classes.

The call returns `added` and `errors`. A student who cannot be added, for example when the batch is full, is listed in `errors` with the reason, and the rest are still added.

For a paid batch, pass `-F 'payment_details:={"amount": 500, "currency": "INR", "source": "<LMS Source>"}'` to record a received payment per student, or `-F 'linked_payments:={"<user>": "<LMS Payment>"}'` to attach existing received ones. This needs a Moderator or an instructor or evaluator tagged on the batch. `source` is optional (omit it, or send null or an empty string, to record the payment without one). Add an optional `address` object (`address_line1`, `city`, `country` required; `address_line2`, `state`, `pincode`, `phone` optional) to `payment_details` to create a Billing address per student. To vary one student, pass `-F 'member_payment_details:={"<user>": {"amount": 250, "currency": "INR", "source": "<LMS Source>", "billing_name": "...", "address": {...}}}'`. Every key is optional, the user must be in `members`, and a student's value beats the common one. A bad value for one student skips only that student.

Read the batch with `method call lms.lms.utils.get_batch_details -F batch=<b>`. It returns the courses, instructors, `student_count` and, when the batch has a seat count, `seats_left`.

Read a student's progress with `method call lms.lms.utils.get_batch_student_progress -F member=<user> -F batch=<b>`. Read the batch as a whole with `get_batch_chart_data -F batch=<b>`.

Email all students with `method call lms.lms.api.send_batch_announcement` and the arguments `batch`, `subject`, `content` (HTML) and `reply_to`. The students get it as BCC.

## Live classes

A live class runs on Zoom or Google Meet. It needs one of these to be set up first:

- **Zoom**: an enabled `LMS Zoom Settings` account. The person who schedules the class also needs their own Google Calendar connected, because the invites go out through it.
- **Google Meet**: an enabled `LMS Google Meet Settings` account with a connected Google Calendar.

If neither is set up, ask the human to set it up in the app. An agent cannot do the Google sign-in.

| Provider | Call |
|---|---|
| Zoom | `method call lms.lms.doctype.lms_batch.lms_batch.create_live_class` with `batch_name`, `zoom_account`, `title`, `duration` (minutes), `date`, `time`, `timezone` and `auto_recording` (`No Recording`, `Local` or `Cloud`) |
| Google Meet | `method call lms.lms.doctype.lms_batch.lms_batch.create_google_meet_live_class` with `batch_name`, `google_meet_account`, `title`, `duration`, `date`, `time` and `timezone` |

Only a batch instructor can schedule a class. Get the host's start link with `method call lms.lms.api.get_live_class_start_url -F live_class=<name>`. List your upcoming classes with `method call lms.lms.api.get_admin_live_classes`. To change a class, update the `LMS Live Class` document. Learning moves the calendar event with it. Deleting a class removes the calendar event, but not the Zoom meeting.

## Evaluations and certificates

Only a Moderator or the course's assigned evaluator can record evaluations and issue certificates.

Record an evaluation with `method call lms.lms.api.save_evaluation_details`. Pass `member`, `course`, `date_value`, `start_time`, `end_time` and `status` (`Pending`, `In Progress`, `Pass` or `Fail`). For a batch, also pass `batch_name`: without it, Learning checks the course's own evaluator instead of the batch course's evaluator, and records a course-wide evaluation. `rating` counts stars from 0 to 5. A `Pass` or `Fail` needs a rating above 0. Calling it again for the same learner and course updates the evaluation.

Issue certificates with these calls:

- One learner: `method call lms.lms.api.save_certificate_details` with `member`, `issue_date`, `template` and `course` or `batch_name`. `template` is a Print Format for `LMS Certificate`. Calling it again for the same learner updates the certificate.
- A whole batch: `method call lms.lms.api.generate_batch_certificates -F batch=<b> -F 'details:={...}'`, where `details` holds `issue_date`, `template`, `course` and `published`. It returns how many certificates it made, and lists the students it skipped, such as those already certified.

Each certificate emails the learner. A course certificate needs the learner to be enrolled in the course. When the course has `enable_certification` on, it also needs 100% progress. Otherwise Learning does not check progress, so check that the learner finished the course first, with `get_batch_student_progress` or the learner's `LMS Enrollment`.
