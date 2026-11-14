# Guest landing page at `/` — design

Status: approved (option 1 for the approach; option A for the copy source). Date: 2026-11-14. Branch: `develop` (dev branch, to be productionised later).

## Intent

Visitors who are not logged in land on `/`. Today the router sends them to the course catalog (`Courses`). Instead, they should see a public landing page for Gradex Classes: programmes by class, the 5-E method, the test series, the branches and a contact band. The layout follows allen.in's home page: top bar, promo strip, hero card, explore tiles, tabbed programme cards, a banner, branch cards and a contact band. The content comes from `gradex-landing-page-ui.md`.

Logged-in users keep the existing home page at `/`.

## Goals

- A guest at `/` sees the landing page, not a redirect.
- Logged-in users see no change at `/`.
- Built from existing frappe-ui components and the app's styling tokens, not a separate stylesheet.
- Works at phone width (about 400px), in light and dark themes.
- Off by default on other sites, so their guests see what they see now.

## Non-goals

- Fees and discount amounts are not shown (confirmed by the user).
- No outcome claims (for example "90%+ results" or "IIT admissions") unless the user confirms them.
- No enrolment form, payment or lead capture. Calls, WhatsApp and the website link only.
- No student testimonials or ranks. None are in the source material.
- No change to the Courses catalog or the login page.
- No productionising work (multi-site content, translations, SEO metadata). That comes after this branch.

## Anti-goals

- A guest must never see a blank page or a spinner while settings load.
- Logged-in users must never be sent to the landing page.
- The landing page must not fetch private course data for guests.

## Constraints

- The router guard in `frontend/src/router.js` (lines 36–80) sends guests to `/login` unless `allow_guest_access` is on. The `/` redirect to `Courses` is in the same guard.
- `allow_guest_access` lives in the `LMS Settings` single doctype (`lms/lms/doctype/lms_settings/lms_settings.json`).
- The SPA is served at `/lms` through `lms/www/_lms.html`. The route table is `frontend/src/routes.js`.
- Frontend tests use Vitest with jsdom (`frontend/vitest.config.ts`). A route test may import the real route table.
- Frontend styles use the app's Tailwind tokens (for example `text-ink-gray-9`, `bg-surface-amber-2`).
- Text a user reads goes through `__()` in Vue.
- The Gradex content must not be copied from allen.in's logo, photos, colours or copy.

## Approaches

Chosen by the user: **option 1, guest landing at `/` inside the SPA.**

Not chosen:
- **Separate public route (`/landing`).** Leaves `/` unchanged, but is not really the front page, and still needs a guest exception.
- **Server-rendered page in `lms/www/`.** Fast and search-friendly, but no frappe-ui components, so it would have its own styling.

## Design

### 1. Setting that turns it on

Add a Check field `show_guest_landing` to `LMS Settings`, default off. Label: "Show landing page to guests". It sits next to `allow_guest_access`.

A patch in `lms/patches.txt` is not needed for a new field with a default of 0. The field is read through `frappe.get_cached_value` as the existing setting is.

For this branch the field is set to on in the dev site's settings, not in code.

### 2. Route and guard

- `routes.js`: keep `/` as `Home`. The component switches on guest status: guests get `Landing`, logged-in users get `Home`. Doing the switch inside the component keeps the route table unchanged.
- `router.js` guard: when `!isLoggedIn` and the target is `/`:
  - if `show_guest_landing` is on, let the navigation through (no redirect to `Courses`).
  - otherwise keep today's redirect to `Courses`.
- The settings fetch already happens in the guard for guests, so the flag is read in the same call. No extra request.

### 3. Landing component

`frontend/src/pages/Landing/Landing.vue`, with sections in child components under `frontend/src/components/Landing/`:

| Section | Component | Built from |
|---|---|---|
| Top bar and promo strip | `LandingHeader.vue` | Button, plain links |
| Hero card with 5-E method | `LandingHero.vue` | Button |
| Explore by class (4 tiles) | `LandingTiles.vue` | router links |
| Programme cards with tab filter | `LandingPrograms.vue` | Tabs-style buttons |
| G.R.E.A.T. test-series banner | `LandingBanner.vue` | Button |
| Why Gradex (6 items) | `LandingWhy.vue` | plain cards |
| Branches (3 cards) | `LandingBranches.vue` | plain cards |
| Contact band | `LandingContact.vue` | Button (copy) |

The copy and the list of programmes, branches and contact lines come from one data file, `frontend/src/pages/Landing/content.ts`, typed by an interface. The components render the data and do not hard-code text.

Text in the data file is plain English. The component wraps any text it renders in `__()`. Because the data is an array of constants, `__()` is called at render time in the component.

### 4. Behaviour

- Programme tabs filter the cards without a route change.
- The "copy" button uses `navigator.clipboard`, and falls back to selecting the text.
- All links to other sites open in a new tab with `rel="noopener"`.
- No API calls. The page is static. The only request is the settings call the guard already makes.

### 5. Accessibility

- One `h1`. Sections use `h2`.
- Tab buttons use `aria-pressed`.
- Focus is visible (the app's focus style).
- Colour contrast meets WCAG AA in both themes. Checked by the existing a11y tests if they cover the component, otherwise by a Vitest check on the tokens used.

### 6. Responsive and theme

- Layouts collapse to one column under 560px and two columns under 860px.
- Colours come from existing tokens, so the dark theme comes for free.
- No fixed heights. Long text wraps.

## Tests

Following the rule that a new feature needs a test that fails without the change:

1. **Router (Vitest):** a guest at `/` with `show_guest_landing` on resolves to `Landing` and is not redirected. Fails today, because the guard redirects to `Courses`.
2. **Router (Vitest):** a guest at `/` with the flag off still redirects to `Courses`. Passes before and after.
3. **Router (Vitest):** a logged-in user at `/` still gets `Home`, regardless of the flag.
4. **Component (Vitest):** `Landing` renders the programme cards, the branch cards and the phone number from the data file, and no fee amounts.
5. **Component (Vitest):** the tab buttons filter the cards.
6. **Python (lms/tests):** `LMS Settings` has the `show_guest_landing` field and defaults it to 0.

Python tests must create the users they act as (`lms/lms/test_helpers.py`). Test 6 needs no user.

## What's left to the builder

- Exact Tailwind classes and spacing values, matching the existing components.
- The icon for each Explore tile (from `lucide-vue-next`, already in the app).
- Exact wording of the `__()` strings.

## Revision 1 (2026-11-14, after approval): new requirements

The user added these after the design was approved. This revision is not yet approved.

1. **Guest access is required.** The landing page reads the course list as a guest. The catalog endpoint `lms.lms.utils.get_courses` is guest-accessible, but its `guest_access_required` decorator needs `allow_guest_access` on. So the landing page works only when guest access is on. The guard already redirects to `/login` when it is off.
2. **Student Login.** The page has a visible "Student Login" button that links to `/login`. It appears in the top bar and in the hero.
3. **Course list (free and paid).** The page shows published courses from `get_courses`. Each card shows a Free or Paid badge, taken from `paid_course`. The course's title, short introduction and image come from the same call.
   - Amounts are not shown. This follows the earlier rule not to show fees. *Proposed, not yet confirmed.*
4. **Delivery mode.** The site is mostly offline, with online self-paced courses as well. Each card shows its delivery mode. The data to decide this is:
   - `LMS Batch.medium` is `Online` or `Offline` (default `Online`).
   - `LMS Course.disable_self_learning` is a Check.
   - There is no course-level delivery field.

**Decided (user, 2026-11-14):** offline courses run in batches, and online courses are self-paced.
- A course with an Offline batch shows the badge "Offline batch".
- A course without an Offline batch shows "Online self-paced". This needs no new field. It is derived from `LMS Batch.medium`.
- Courses that have both an Offline batch and self-paced content show "Offline batch" only, to keep each card to one label. *Proposed, not yet confirmed.*

## Decision

**Copy source: A.** The Gradex copy is hard-coded in `frontend/src/pages/Landing/content.ts`. Other sites would need it moved to LMS Settings before they could use the page (option B). Recorded as approved on 2026-11-14.

## Revision 2 (2026-11-14): brand elements per site (option 2)

The user chose option 2: the brand elements are set per site in LMS Settings, not in code. This replaces decision A.

**Configurable (new "Landing page" tab in LMS Settings):**
- Brand name, logo and primary colour. Name falls back to the site name from Website Settings when blank.
- Promo strip text.
- Hero eyebrow, headline and lede.
- Carousel slides (child table `LMS Landing Slide`: eyebrow, title, text, CTA label, CTA link).
- Branches (child table `LMS Landing Branch`: label, name, address, phone).
- Contact: phone, email, website.

**Not configurable yet (product copy in `content.ts`):** the explore tiles, the "Why Gradex" items, the method steps and the test-series banner text.

**Read path:** one guest endpoint, `lms.lms.api.get_landing_content`, rate-limited, returns the configured values. It returns nothing unless `show_guest_landing` is on. The page reads it once and falls back to neutral placeholders for blank values. No Gradex text remains in code for the configurable elements.

**Validation:** primary colour must be a 6-digit hex value. CTA links must be a path starting with `/` or `#`, or an `https://` URL.

**Decided by me, to confirm:** the four tiles and the "Why Gradex" items stay in code for now, because they are generic programme copy. Say if they should move into settings too.
