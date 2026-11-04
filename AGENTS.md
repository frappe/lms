# Frappe Learning — Project Context

## What this project is

Frappe Learning (`frappe/lms`) is a learning management system built on the Frappe
Framework. The backend is a Frappe app in `lms/`; the learner and instructor UI is a
Vue 3 single-page app in `frontend/`, built with frappe-ui and served at `/lms`.

Instructors build courses (chapters and lessons with quizzes, assignments and
programming exercises) and run batches (a group of students taking courses together
with live classes, assessments and evaluations). Learners enroll, track progress and
earn certificates.

---

## Layout

| Path | What lives there |
|---|---|
| `lms/lms/doctype/` | The DocTypes and their controllers |
| `lms/lms/api.py` | Whitelisted methods the frontend calls |
| `lms/lms/utils.py` | Reads for lists and pages: courses, batches, quizzes, progress |
| `lms/lms/permissions.py` | Who may read, change or enroll in courses, batches, lessons and assessments |
| `lms/hooks.py` | App hooks: permissions, scheduler jobs, website routes |
| `lms/patches.txt`, `lms/patches/` | Data patches for existing sites |
| `lms/www/` | Web entry points; `_lms.html` is the built SPA shell |
| `frontend/src/routes.js` | Every frontend route |
| `frontend/src/pages/` | One component per route |
| `frontend/src/components/` | Shared components |
| `frontend/src/composables/` | Shared logic, e.g. `useFormRoute` for forms opened as child routes |
| `frontend/src/stores/` | Session, user and settings stores |
| `frontend/src/tests/` | Vitest tests |
| `lms/tests/` | Python tests |
| `e2e/` | Playwright UI tests |
| `skills/frappe-learning/` | A skill that explains the product to AI assistants |

`lms/public/frontend/` and `lms/www/_lms.html` are build output and are not committed.

---

## Conventions

- Access checks go through the helpers in `lms/lms/permissions.py`, not role checks
  written inline. A method with `allow_guest=True` needs a rate limit and must not
  return content a guest cannot open.
- Business logic and validation belong in the DocType controller, not only in a
  whitelisted method or the Vue form.
- Schema changes that affect existing sites need a patch in `lms/patches.txt`.
- UI uses frappe-ui components before custom markup.
- Text a user reads is wrapped in `__()` in Vue and `_()` in Python so it can be
  translated. Translations are managed on Crowdin; do not edit `lms/locale/` by hand.
- When fixing a bug, check its siblings: course and batch; quiz, assignment and
  programming exercise; lesson page and course editor; desktop and mobile layout.

---

## Tests

```bash
# Python, from the bench directory
bench --site <site> run-tests --app lms

# Frontend, from frontend/
yarn test             # single run
yarn test:watch       # watch mode

# UI tests, from the app root
yarn test-local       # Playwright with its UI
```

- New features need a test that fails without the change.
- Python tests must create the users they act as. The helpers in
  `lms/lms/test_helpers.py` default to `frappe@example.com`, which does not exist in CI.

---

## Commits and pull requests

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `ci:`, with
  an optional scope such as `fix(quiz):`.
- One commit per coherent change.
- Pull requests go to `develop`. Fixes reach release branches through the
  `backport main-hotfix` and similar labels.
- A UI change needs before and after screenshots in the PR.
- Pre-commit runs ruff, prettier and eslint. If a hook changes a file, stage it again
  and recommit.
