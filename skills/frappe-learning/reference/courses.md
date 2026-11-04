# Courses, lessons, assessments and programs

## Course structure

```
LMS Course
└── Course Chapter                      (course → LMS Course)
    └── Course Lesson                   (chapter → Course Chapter, course → LMS Course)
        └── content blocks              a quiz, assignment or program block names one of these:
            ├── LMS Quiz                └── LMS Question rows
            ├── LMS Assignment
            └── LMS Programming Exercise
```

Each level links to the one above it, and the parent keeps the order in a table:

| Document | Links to | Order kept in |
|---|---|---|
| `Course Chapter` | `course` | the course's `chapters` table (`Chapter Reference` rows with `chapter`) |
| `Course Lesson` | `chapter` and `course` | the chapter's `lessons` table (`Lesson Reference` rows with `lesson`) |

Use `upsert_chapter`, `create_lesson`, `update_chapter_index` and `update_lesson_index` to change this structure. They keep the order tables and the links in step.

An assessment is its own document, and a lesson names it in a block of its `content`. `LMS Quiz` also has optional `lesson` and `course` fields, and `LMS Assignment` an optional `course` field.

The learner's records link back to the structure:

| Record | Links |
|---|---|
| `LMS Enrollment` | `member`, `course`, and `current_lesson`, `payment`, `certificate`, `enrollment_from_batch` when they apply |
| `LMS Course Progress` | `member`, `course`, `chapter`, `lesson` |
| `LMS Quiz Submission` | `member`, `quiz`, `course`. Each answer is a row in `result`. |
| `LMS Assignment Submission` | `member`, `assignment`, `lesson`, `course`, `evaluator` |
| `LMS Programming Exercise Submission` | `member`, `exercise`. Each test case result is a row in `test_cases`. |

## Lesson content

A lesson keeps its content in the `content` field of `Course Lesson`, as an Editor.js JSON string:

```json
{"time": 1770118649591, "version": "2.29.0", "blocks": [
  {"type": "header", "data": {"text": "Getting started", "level": 2}},
  {"type": "paragraph", "data": {"text": "Watch the video, then take the quiz."}},
  {"type": "embed", "data": {"service": "youtube", "source": "https://www.youtube.com/watch?v=QhA4h6qD4wY", "embed": "QhA4h6qD4wY", "caption": ""}},
  {"type": "quiz", "data": {"quiz": "<LMS Quiz name>"}}
]}
```

Write the JSON to a file and send it with `doc update "Course Lesson" "<lesson>" --input <file>`, where the file holds `{"content": "<the JSON above, as a string>"}`. The value is a string, not an object.

| Block | `data` |
|---|---|
| `paragraph` | `text` (inline HTML: `<b>`, `<i>`, `<a href>`, `<code>`) |
| `header` | `text`, `level` (2 to 4) |
| `list` | `style` (`ordered` or `unordered`), `items` `[{"content": "...", "items": []}]` |
| `table` | `content` (a list of rows, each a list of cells) |
| `image` | `url`, `caption` |
| `upload` | `file_url`, `file_type` (a file you uploaded with `frappectl file upload`) |
| `embed` | `service`, `source`, `embed` (YouTube, Vimeo and others) |
| `markdown` | `text` |
| `codeBox` | `code`, `language` |
| `quiz` | `quiz`: an `LMS Quiz` name |
| `assignment` | `assignment`: an `LMS Assignment` name |
| `program` | `exercise`: an `LMS Programming Exercise` name |

When a lesson is saved, Learning does these things:

- It cleans the HTML in each block. Script tags and event attributes are removed.
- It saves text that is not valid JSON with no error, and the lesson page then cannot show it. Read the lesson back after you write it.
- It checks each `quiz`, `assignment` and `program` block. A block that names a quiz that does not exist stops the save.

`instructor_content` uses the same format. Only instructors see it.

An older lesson can have Markdown in `body` and no `content`. Learning shows `body` only when `content` is empty.

## Which assessment to use

Pick the assessment by how the answer is checked:

- **Quiz**: the answers can be marked right or wrong on their own: choices, or short typed answers that match a list. Learning scores it at once, and a learner can try again up to the quiz's `max_attempts`. Add an `Open Ended` question only when a few answers need a person to read them.
- **Assignment**: the work needs a person to read it, such as an essay, a report, a design or a link to a project. An evaluator grades each submission with a status and comments.
- **Programming exercise**: the learner writes code, and the test cases check it.

## Quizzes

A quiz is an `LMS Quiz` with `title`, `passing_percentage` and a `questions` table. Each row links an `LMS Question` and gives its `marks`.

1. Make each question: `doc create "LMS Question"` with `question` (HTML) and `type` (`Choices`, `User Input` or `Open Ended`).
   - For `Choices`, set `option_1` to `option_10` and mark the right ones with `is_correct_1` to `is_correct_10`. Set `multiple` to 1 when more than one option is correct.
   - For `User Input`, set the accepted answers in `possibility_1` to `possibility_10`.
2. Make the quiz with `questions` `[{"question": "<LMS Question name>", "marks": 1}]`.
3. Add a `quiz` block that names the quiz to the lesson.

Learning works out `total_marks` when the quiz is saved. A course with a published quiz that has no questions shows a warning when you publish the course.

## Assignments and programming exercises

- `LMS Assignment` needs `title`, `question` (HTML) and `type`, which sets what the learner hands in:

  | `type` | The learner submits |
  |---|---|
  | `Text` | a written answer in the editor |
  | `URL` | a link, which must start with `http` or `https` |
  | `PDF` | a `.pdf` file |
  | `Document` | a Word file: `.doc`, `.docx` or `.xml` |
  | `Image` | an image file |

  Set `grade_assignment` when an evaluator should mark each submission `Pass` or `Fail`. Set `show_answer` and `answer` to show a model answer after the learner submits. Set `enable_scheduling` with `schedule_start` and `schedule_end` to accept submissions only in that window. A learner can submit once per assignment.
- `LMS Programming Exercise` needs `title`, `problem_statement` and `language`: `Python`, `JavaScript`, `Rust` or `Go`. Add its checks in the `test_cases` table, one row per case, with `input`, `expected_output` (required) and `hidden` to keep the case out of the learner's view.

Add either one to a lesson with an `assignment` or `program` block. You can only add an assessment that you are allowed to manage.

## Programs

A program is an `LMS Program`. Its name is its title. Set `program_courses` `[{"course": "<c>"}]`, `published`, and `enforce_course_order` to make learners take the courses in order.

To add a learner to a program, add a row to `program_members`. This does not enroll them in the program's courses. Enroll them in each course too.
