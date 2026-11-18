# The setup plan on the site

Keep the plan as one `Note`, so any later session, in any assistant, can read where the setup stands. A Note exists on every Frappe site and needs nothing installed.

- `title`: `Learning setup plan`. One plan per site. Find it with `{"title": ["like", "Learning setup plan%"]}`.
- `public`: 1. A Note that is not public is visible only to its owner, so nobody else, and no other session signed in as someone else, could read the plan.
- `content`: HTML, in the shape below. Write it in the person's language and words.

Read the whole Note before you change it, and write it back whole: `content` is one field. Show the edit and wait for a yes, as with every write.

## Shape

```html
<h3>About</h3>
<p><b>Business:</b> what they do, for whom, in one line.<br>
<b>Started:</b> 2026-11-16<br>
<b>Live means:</b> "Every new hire finishes Onboarding in their first two weeks" (their words).<br>
<b>Live check:</b> every LMS Enrollment in Onboarding created more than 14 days ago has progress 100.<br>
<b>Set up by:</b> partner@example.com (setup users; leave empty when the business set itself up)</p>

<h3>Agreed</h3>
<ul>
<li>First course: Onboarding, 5 chapters, 18 lessons</li>
<li>Course team: 2 Course Creators, 1 Batch Evaluator</li>
<li>Learners: about 40 in the first month</li>
</ul>

<h3>Steps</h3>
<table>
<tr><th>#</th><th>Step</th><th>Why</th><th>Who</th><th>Status</th></tr>
<tr><td>1</td><td>Your Onboarding course has its outline</td><td>Every new hire takes it in week one</td><td>Setup</td><td>Done 2026-11-16</td></tr>
<tr><td>2</td><td>Every lesson has its content</td><td>You have the slides from the induction day</td><td>Setup, from your material</td><td>To do</td></tr>
<tr><td>9</td><td>Learners have started</td><td>The first sign the induction day can be shorter</td><td>Your learners</td><td>To do</td></tr>
</table>

<h3>Asked for, not in this setup</h3>
<ul><li>2026-11-16: "Can we charge partners for the advanced course?"</li></ul>

<h3>Log</h3>
<p>Newest first. 2026-11-16: outline done. Content waits for the safety slides.</p>
```

## Rules

- **Status** is `To do`, `Done <date>` or `Not needed: <reason>`. Mark a step done only after its Done when check passed on the data.
- **Who** is one of: Setup (you, or whoever sets up), Setup from your material, You invite and they sign in, Your team, Your learners.
- Learners who are not desk users cannot read a Note. The plan is for the course team.
- Put the agreed values under "Agreed". The checks in `steps.md` compare the site against them.
- Never put a password, key or personal data beyond names and work emails in the Note. Every desk user can read it.
- When the plan changes after a session, change the steps and add a log line saying why.
