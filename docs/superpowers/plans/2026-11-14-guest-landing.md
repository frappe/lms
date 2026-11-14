# Guest Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guests who open `/` on a site with `show_guest_landing` turned on see a public Gradex Classes landing page instead of being redirected to the course catalog.

**Architecture:** A new `show_guest_landing` Check field on LMS Settings is exposed through `get_lms_settings`. The router guard lets guests reach `/` when it is on. `Home.vue` renders a `Landing` page for guests and the existing home for logged-in users. The page is eight small components that read one typed data file, `content.ts`, and use frappe-ui buttons and the app's colour tokens.

**Tech Stack:** Python (Frappe DocType JSON, whitelisted method), Vue 3 `<script setup lang="ts">`, frappe-ui, Pinia, Vitest with jsdom, Tailwind tokens.

**Spec:** `docs/superpowers/specs/2026-11-14-guest-landing-design.md` (approved). Copy and facts: `gradex-landing-page-ui.md` at the repo root.

## Global Constraints

- Setting name: `show_guest_landing`, Check field, default `0`, label `Show landing page to guests`, placed directly after `allow_guest_access` in `lms_settings.json`.
- Fees and discount amounts never appear on the page. Check with a test (Task 3).
- Phone for the Delhi branch is `+11 45603653`. Muzaffarpur and Motipur share `+91 7903466927`.
- Every user-visible string in Vue is wrapped in `__()`. Copy in `content.ts` is plain text; the components call `__()` on it when rendering.
- No outcome claims (no "90%+ results", no "IIT admissions"). No enrolment form. No testimonials or ranks.
- Do not copy allen.in logo, photos, colours or copy.
- Do not `git commit` or `git push` in any task. Commit only when the user asks.
- Frontend test command: `cd frontend && yarn vitest run <path>`.
- Python test command (dev stack): `docker exec lms-frappe-1 bash -c "cd /home/frappe/frappe-bench && bench --site lms.localhost run-tests --app lms --module <module>"`.

## Review Focus

1. A guest opens `/` while the settings request fails. The page must not stay blank: it falls back to the course catalog redirect. (Task 4, test `falls back to Courses when settings fail`.)
2. The browser clipboard refuses the copy. The phone number must still be selectable. (Task 3, test `copy falls back to selecting the number when clipboard is refused`.)
3. A logged-in user opens `/`. They must get the home page, never the landing page. (Task 5, test `logged-in user at / gets Home, not Landing`.)
4. Keyboard users switch programme tabs. The active tab must expose `aria-pressed`. (Task 3, test `tab buttons set aria-pressed and filter cards`.)
5. A phone 320px wide. The page must not scroll sideways. Not practical to pin in jsdom; checked by hand in Task 6, step 3.

---

### Task 1: Backend setting exposed to the SPA

**Files:**
- Modify: `lms/lms/doctype/lms_settings/lms_settings.json` (after the `allow_guest_access` field, around line 375)
- Modify: `lms/lms/api.py` (the `allowed_fields` list in `get_lms_settings`, around line 2676)
- Modify: `frontend/src/types/lms/LMSSettings.ts` (after `allow_guest_access`, line 76)
- Test: `lms/lms/doctype/lms_settings/test_lms_settings.py`

**Interfaces:**
- Consumes: the existing `get_lms_settings()` whitelisted method, which returns only fields in `allowed_fields`.
- Produces: `show_guest_landing: 0 | 1` on the settings object returned by `lms.lms.api.get_lms_settings`, and on the `LMSSettings` TypeScript type.

- [ ] **Step 1: Write the failing tests**

Append to `test_lms_settings.py`, as a new class:

```python
class TestShowGuestLanding(IntegrationTestCase):
    def test_field_exists_and_defaults_to_off(self):
        meta = frappe.get_meta("LMS Settings")
        field = meta.get_field("show_guest_landing")
        self.assertIsNotNone(field)
        self.assertEqual(field.fieldtype, "Check")
        self.assertEqual(str(field.default), "0")

    def test_guest_can_read_the_flag_from_get_lms_settings(self):
        from lms.lms.api import get_lms_settings

        frappe.set_user("Guest")
        self.addCleanup(frappe.set_user, "Administrator")
        settings = get_lms_settings()
        self.assertIn("show_guest_landing", settings)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `docker exec lms-frappe-1 bash -c "cd /home/frappe/frappe-bench && bench --site lms.localhost run-tests --app lms --module lms.lms.doctype.lms_settings.test_lms_settings"`
Expected: FAIL. `show_guest_landing` is not a field, so `get_field` returns `None`.

- [ ] **Step 3: Add the field and expose it**

- In `lms_settings.json`, insert after the `allow_guest_access` object: `{"default": "0", "fieldname": "show_guest_landing", "fieldtype": "Check", "label": "Show landing page to guests"}`. Keep the JSON valid (comma placement).
- In `api.py`, add `"show_guest_landing",` to `allowed_fields` in `get_lms_settings`, directly under `"allow_guest_access",`.
- In `LMSSettings.ts`, add `show_guest_landing?: 0 | 1` directly under `allow_guest_access?: 0 | 1`.

No patch is needed. A new Check field with a default of 0 reads as 0 on existing sites.

- [ ] **Step 4: Run the tests to verify they pass**

Same command as Step 2. Expected: PASS, both tests.

---

### Task 2: Typed content file

**Files:**
- Create: `frontend/src/pages/Landing/content.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (exact exports, all plain constants):

```ts
export type ProgrammeGroup = 'foundation' | 'preboard' | 'launch' | 'entrance'

export interface Programme {
  title: string        // e.g. 'Foundation Batch'
  badge: string        // e.g. 'Class 5–8'
  group: ProgrammeGroup
  focus: string        // one line, shown bottom-left of the card
  points: string[]     // 3–5 bullets, from gradex-landing-page-ui.md
}

export interface Tile { range: string; title: string; text: string; group: ProgrammeGroup }
export interface Branch { label: string; name: string; address: string; phone?: string }
export interface ContactLine { label: string; value: string; copyable?: boolean; href?: string }
export interface FeatureCard { title: string; text: string }

export const promo: string
export const hero: { eyebrow: string; headline: string; lede: string }
export const methodSteps: { name: string; hint: string }[]   // Engage, Explore, Explain, Elaborate, Evaluate
export const tiles: Tile[]           // 4 entries: Foundation 5–8, Pre-Board 9–10, Launch Pad 11–12, Rank Booster after 12
export const programmes: Programme[] // 6 entries, in this order: Foundation Batch, Pre-Board Programme, Launch Pad, IIT-JEE / NEET Rank Booster, Score Booster, G.R.E.A.T. Test Series
export const testSeries: { title: string; text: string }
export const whyItems: FeatureCard[] // 6 entries
export const branches: Branch[]      // 3 entries: Bhagwanpur (Muzaffarpur), Motipur, Janakpuri East (New Delhi)
export const contact: { heading: string; lede: string; lines: ContactLine[] }
```

- Values that must be exact:
  - `branches[2].phone` is `'+11 45603653'`.
  - `branches[0].phone` and `branches[1].phone` are `'+91 7903466927'`. Motipur carries no second number.
  - `contact.lines[0]` is `{ label: 'Call or WhatsApp', value: '+91 7903466927', copyable: true }`.
  - `contact.lines[1]` is the website, `https://www.mygradex.com`, with `href` set.
  - `contact.lines[2]` is `info@mygradex.com`.
  - `promo` is `'Free scholarship test for 2026-27. Pick your branch and class.'`.

- [ ] **Step 1: Write the content file**

Copy the text from the `gradex-landing-page-ui.md` sections "Programmes", "Branches" and "Contact", and from the copy of the landing page in `scratchpad/gradex-classes.html` (the most recent published version of the page). Keep every number and phone as written in the brief. No fees, no discounts.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx vue-tsc --noEmit -p tsconfig.json 2>&1 | grep "pages/Landing/content" || echo "no errors in content.ts"`
Expected: `no errors in content.ts`. If `vue-tsc` is not available, run `npx tsc --noEmit` and filter the same way.

---

### Task 3: Landing components and page

**Files:**
- Create: `frontend/src/components/Landing/LandingHeader.vue`
- Create: `frontend/src/components/Landing/LandingHero.vue`
- Create: `frontend/src/components/Landing/LandingTiles.vue`
- Create: `frontend/src/components/Landing/LandingPrograms.vue`
- Create: `frontend/src/components/Landing/LandingBanner.vue`
- Create: `frontend/src/components/Landing/LandingWhy.vue`
- Create: `frontend/src/components/Landing/LandingBranches.vue`
- Create: `frontend/src/components/Landing/LandingContact.vue`
- Create: `frontend/src/pages/Landing/Landing.vue`
- Test: `frontend/src/tests/landingPage.test.ts`

**Interfaces:**
- Consumes: every export of `content.ts` (Task 2).
- Produces: `Landing.vue`, a component with no props, that Task 5 renders for guests.
- `LandingTiles` emits `select(group: ProgrammeGroup)` when a tile is clicked. `Landing.vue` passes it to `LandingPrograms` as the `group` prop, which sets the active tab.
- `LandingPrograms` takes `group?: ProgrammeGroup | 'all'` (default `'all'`). It keeps an internal active tab and syncs when the prop changes.
- `LandingContact` copies `copyable` lines through `navigator.clipboard.writeText` in a click handler. On rejection, or when clipboard is missing, it selects the number's text and sets the button label to `__('Ctrl+C')`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/tests/landingPage.test.ts` with these tests. Mount `Landing.vue` with `mount` from `@vue/test-utils`. Use the data from `content.ts` for the expected counts, not literals.

```ts
it('renders every programme card, branch and the Delhi phone', () => {
  // programmes.length cards in the programme grid
  // branches.length branch cards
  // text '+11 45603653' appears in the document
})

it('shows no fee amounts', () => {
  expect(wrapper.text()).not.toMatch(/₹/)
})

it('tab buttons set aria-pressed and filter cards', async () => {
  // click the tab for group 'launch'
  // exactly one tab has aria-pressed="true", and it is the clicked one
  // only cards whose group is 'launch' remain visible (hidden attribute absent)
})

it('copy falls back to selecting the number when clipboard is refused', async () => {
  // stub navigator.clipboard.writeText to reject
  // click the copy button
  // after flushing promises, the button text is 'Ctrl+C'
  // window.getSelection().toString() includes '+91 7903466927'
})
```

Stub `navigator.clipboard` with `Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('refused')) }, configurable: true })`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && yarn vitest run src/tests/landingPage.test.ts`
Expected: FAIL. `Landing.vue` does not exist yet.

- [ ] **Step 3: Implement the components**

- Each component is `<script setup lang="ts">`, imports its data from `@/pages/Landing/content`, and renders with frappe-ui `Button` for every button.
- Use the Tailwind token classes already used in `pages/Home/Home.vue` (for example `text-ink-gray-9`, `text-ink-gray-6`, `bg-surface-amber-2`). No new colours.
- Every user-visible string goes through `__()`. For data strings from `content.ts`, call `__(item.title)` at render time.
- `LandingPrograms` grid: `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3`. Each card root is `min-w-0`.
- Tabs are `<button type="button">` elements with `:aria-pressed="String(active === tab.value)"`. Tabs: All, Class 5–8, Class 9–10, Class 11–12, JEE / NEET. Each maps to the groups listed in the table below. A card's `hidden` attribute is set when it is not in the active group.

  | Tab | Groups shown |
  |---|---|
  | All | every group |
  | Class 5–8 | `foundation` |
  | Class 9–10 | `preboard` |
  | Class 11–12 | `launch` |
  | JEE / NEET | `entrance` |

- `LandingContact` copy button: `@click` calls `navigator.clipboard.writeText(value)` inside the click handler, with `.then(done, fallback)`. Only then does `done` set the label to `__('Copied')` and reset it after 1800ms. `fallback` selects the text and sets the label to `__('Ctrl+C')`. If `navigator.clipboard` is undefined, call `fallback` directly.
- `Landing.vue`: the root is `<div class="min-h-screen bg-surface-white">`. It renders the components in this order: `LandingHeader`, `LandingHero`, `LandingTiles`, `LandingPrograms`, `LandingBanner`, `LandingWhy`, `LandingBranches`, `LandingContact`, and a footer.
- The page has one `<h1>` (in `LandingHero`), and `<h2>` for each section heading.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && yarn vitest run src/tests/landingPage.test.ts`
Expected: PASS, four tests.

---

### Task 4: Router guard lets guests reach `/`

**Files:**
- Modify: `frontend/src/router.js` (the `if (!isLoggedIn)` block, lines 50–58)
- Test: `frontend/src/tests/guestLandingGuard.test.ts`

**Interfaces:**
- Consumes: `guardNavigation(to, from, next)` (already exported from `router.js`), `useSettings()` from `@/stores/settings`, `sessionStore()` and `usersStore()`.
- Produces: no new exports. The change is the branch for `to.name === 'Home'` when `!isLoggedIn`.

The new block, replacing the current `if (!isLoggedIn)` block:

```js
if (!isLoggedIn) {
    await settings.promise
    if (!settings.data?.allow_guest_access) {
        window.location.href = '/login'
        return
    }
    if (to.name === 'Home' && !settings.data?.show_guest_landing) {
        return next({ name: 'Courses' })
    }
}
```

The old code pushed `Courses` before awaiting settings. Redirecting straight to `/login` when guest access is off gives the same end result.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/tests/guestLandingGuard.test.ts`. Mock `@/stores/session` (`isLoggedIn: false`), `@/stores/user` (`userResource` with a resolved promise), and `@/stores/settings` (`settings` with `promise` and `data`). Import `guardNavigation` from `@/router`. Spy on `router.push` if needed.

```ts
it('lets a guest reach / when show_guest_landing is on', async () => {
  // settings.data = { allow_guest_access: 1, show_guest_landing: 1 }
  // await guardNavigation({ name: 'Home', path: '/' }, {}, next)
  // expect(next).toHaveBeenCalledWith()        // no arguments: no redirect
  // expect(routerPush).not.toHaveBeenCalledWith({ name: 'Courses' })
})

it('sends a guest to Courses from / when show_guest_landing is off', async () => {
  // settings.data = { allow_guest_access: 1, show_guest_landing: 0 }
  // expect(next).toHaveBeenCalledWith({ name: 'Courses' })
})

it('falls back to Courses when settings fail', async () => {
  // settings.data = undefined (request failed)
  // expect(next).toHaveBeenCalledWith({ name: 'Courses' })
  // and not called with no arguments
})

it('logged-in user at / gets Home, not Landing', async () => {
  // isLoggedIn = true, settings irrelevant
  // expect(next).toHaveBeenCalledWith()
  // expect(to.name).toBe('Home') still renders Home.vue (checked in Task 5)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && yarn vitest run src/tests/guestLandingGuard.test.ts`
Expected: FAIL on the first test (`lets a guest reach /`). The current guard calls `router.push({ name: 'Courses' })`.

- [ ] **Step 3: Replace the guest block**

Apply the block from the Interfaces section, replacing the existing `if (!isLoggedIn) { ... }` block in `guardNavigation`. Leave the setup check and everything after it as they are.

- [ ] **Step 4: Run the tests to verify they pass**

Same command as Step 2. Expected: PASS, all four tests.

---

### Task 5: `Home.vue` renders the landing page for guests

**Files:**
- Modify: `frontend/src/pages/Home/Home.vue`
- Test: `frontend/src/tests/guestLandingHome.test.ts`

**Interfaces:**
- Consumes: `Landing.vue` (Task 3), `sessionStore().isLoggedIn`.
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/tests/guestLandingHome.test.ts`. Mount `Home.vue` with `sessionStore` mocked to `isLoggedIn: false`, and again with `isLoggedIn: true`.

```ts
it('guest sees the landing page', () => {
  // wrapper.findComponent(Landing).exists() is true
  // the StudentHome and AdminHome components are not rendered
})

it('logged-in user sees the home page, not the landing page', () => {
  // wrapper.findComponent(Landing).exists() is false
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && yarn vitest run src/tests/guestLandingHome.test.ts`
Expected: FAIL on the guest case. `Home.vue` has no landing branch yet.

- [ ] **Step 3: Implement the branch**

- Import `Landing` from `@/pages/Landing/Landing.vue`.
- Add `const isGuest = computed(() => !sessionStore().isLoggedIn)` (the file already imports `sessionStore` and `computed`).
- At the top of the template, add `<Landing v-if="isGuest" />`. Wrap the existing root `<div class="w-full p-5">` and the `Streak` modal in `<template v-else>`.
- The resources in `Home.vue` must not request logged-in data for guests. For each `createResource` in the script, set `auto: !isGuest.value`, or move the call into `onMounted` behind `if (!isGuest.value)`. Do not change what logged-in users get.

- [ ] **Step 4: Run the test to verify it passes**

Same command as Step 2. Expected: PASS, both tests.

---

### Task 6: Turn it on and check by hand

**Files:** none changed in the repository.

**Interfaces:**
- Consumes: the running dev stack (`lms-frappe-1`), the `lms.localhost` site.
- Produces: a checked page on the dev site.

- [ ] **Step 1: Rebuild the frontend in the container**

Run: `docker exec lms-frappe-1 bash -c "cd /home/frappe/frappe-bench && bench build --app lms"`
Expected: `✔ lms built`. The frontend is built from the mounted checkout, so Task 3–5 changes are included.

- [ ] **Step 2: Switch the flag on for the dev site**

Run: `docker exec lms-frappe-1 bash -c "cd /home/frappe/frappe-bench && bench --site lms.localhost set-value 'LMS Settings' 'LMS Settings' show_guest_landing 1 && bench --site lms.localhost clear-cache"`
Expected: no error. Then confirm with `bench --site lms.localhost get-value` or by reading the page.

- [ ] **Step 3: Check at phone width and in both themes**

Open http://lms.localhost:8000/lms in a private window (guest). In a browser at 320px width and 1280px width:
- The landing page loads at `/` and not `/courses`.
- No horizontal scrollbar at 320px.
- Tabs filter the cards; the phone number copies or is selectable.
- Switch the OS to dark mode. Text is readable on the background.

Then log in as Administrator and open `/`. The home page appears, not the landing page.

- [ ] **Step 4: Run the full frontend and backend tests for the feature**

Run: `cd frontend && yarn vitest run src/tests/landingPage.test.ts src/tests/guestLandingGuard.test.ts src/tests/guestLandingHome.test.ts`
Expected: PASS.

Run: `docker exec lms-frappe-1 bash -c "cd /home/frappe/frappe-bench && bench --site lms.localhost run-tests --app lms --module lms.lms.doctype.lms_settings.test_lms_settings"`
Expected: PASS.

- [ ] **Step 5: Report**

Report to the user: which tests passed, what was checked by hand, and anything that was not checked (the 320px check is manual). Do not commit. Ask whether to commit.

---

## Self-Review

- **Spec coverage:** the flag (Task 1), the guard (Task 4), the Home branch (Task 5), the components and data (Tasks 2–3), accessibility and responsive behaviour (Task 3, Review Focus 4–5), the six planned tests (Tasks 1, 3, 4, 5 cover all six), and the open-copy decision A (Task 2). Each spec section has a task.
- **Interfaces:** `ProgrammeGroup` values (`foundation`, `preboard`, `launch`, `entrance`) match between `content.ts`, the tab table, and the tiles' `group` field. `show_guest_landing` is spelled the same in the DocType JSON, `api.py`, the TypeScript type, the guard, and the tests.
- **Review Focus:** each of the five lines has a test or a named manual check in the owning task.
- **Gaps:** the spec's Python test (`show_guest_landing` defaults to 0) is in Task 1. The e2e suite is not in scope.
