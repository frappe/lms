import { test, expect } from "./fixtures";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	closeOnboardingModal,
	button,
	deleteLeftovers,
	waitForApiCall,
} from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Unique per run: generate_slug() (lms/lms/utils.py) doesn't error on a
// title collision, it appends "-1", "-2"... which would silently desync
// every hardcoded courseSlug reference below against a leftover from a
// previous failed run. A fresh title sidesteps that outright — no leftover
// to collide with, and no beforeAll needed to hunt one down and delete it.
const courseTitle = `Test Course ${Date.now()}`;
// Set once the create step below redirects; every later test in this file
// reuses it, same as the course itself.
let courseSlug: string;
// The thumbnail is uploaded unattached, so deleting the course leaves it.
let thumbnailFile: string;
const description =
	"Test Course Description. I need a very big description to test the UI. This is a very big description. It contains more than once sentence. Its meant to be this long as this is a UI test. Its unbearably long and I'm not sure why I'm typing this much. I'm just going to keep typing until I feel like its long enough. I think its long enough now. I'm going to stop typing now.";

// Both a button and a [role=tab] can host the same label depending on
// screen size (CourseDetail's tab bar collapses to a dropdown on mobile).
const settingsTab = (page: import("@playwright/test").Page) =>
	page
		.getByRole("button")
		.or(page.getByRole("tab"))
		.filter({ hasText: "Settings" });

test.describe("Course Creation", () => {
	// Every test after the first reads the course the first one creates, and
	// courseSlug lives only in the worker that set it. Serial retries the whole
	// chain in one worker instead of rerunning a later test without it.
	test.describe.configure({ mode: "serial" });

	// "deletes the course" removes the course through the UI; this catches a
	// chain that failed before it, and the thumbnail no UI flow deletes.
	test.afterAll(async () => {
		await deleteLeftovers([
			{ method: "lms.lms.api.delete_course", args: { course: courseSlug } },
			{ doctype: "File", name: thumbnailFile },
		]);
	});

	test("creates a new course with settings", async ({ page }) => {
		await page.goto("/lms/courses");
		await closeOnboardingModal(page);

		// Open New Course modal
		await button(page, "New Course").click();

		// The form is a route now (NewCourseForm.vue); scope to its own fields
		// rather than to the last layer on the page.
		//
		// No whole-wrapper visibility assertion: the fields scroll inside the
		// dialog on a short CI viewport, and Playwright's per-locator actions
		// already auto-wait and auto-scroll the specific element they touch —
		// the wrapper itself never needs to be "visible" as a whole.
		const fields = page.getByTestId("new-course-fields");
		await fields
			.locator("label")
			.filter({ hasText: "Title" })
			.locator("xpath=..")
			.locator("input")
			.fill(courseTitle);

		// The form pre-fills the signed-in user as instructor; clicking their
		// option would deselect them and the form now refuses to save.
		await expect(
			fields
				.locator("label")
				.filter({ hasText: "Instructors" })
				.locator("xpath=..")
				.locator("button")
				.first()
		).toContainText("Frappe");

		// Thumbnail
		const upload = waitForApiCall(page, "/api/method/upload_file");
		await fields
			.locator('input[type="file"]')
			.setInputFiles(path.join(__dirname, "fixtures/profile.png"));
		thumbnailFile = (await (await upload).json()).message.name;

		// Short introduction
		await fields
			.locator("label")
			.filter({ hasText: "Short introduction" })
			.locator("xpath=..")
			.locator("textarea")
			.fill("Test Course Short Introduction to test the UI");

		// Description
		await fields.locator("div.ProseMirror").evaluate((el, text) => {
			el.textContent = text;
		}, description);

		// Save sits in the shell's action slot, outside the fields above.
		await page.getByTestId("new-course-save").click();

		// Redirect to course settings. The slug isn't known ahead of time (see
		// the courseTitle comment above), so it's read off the URL Vue Router
		// actually lands on rather than asserted against a guessed value.
		// The form's own route is /lms/courses/new, which a plain
		// /\/lms\/courses\/[^/]+$/ also matches — excluding "new" is what
		// actually waits for the post-save redirect rather than the form's
		// own already-current URL.
		await page.waitForURL(/\/lms\/courses\/(?!new(?:$|[/#]))[^/]+$/, {
			timeout: 10000,
		});
		courseSlug = new URL(page.url()).pathname.split("/").pop() as string;
		await closeOnboardingModal(page);

		// Configure settings
		await settingsTab(page).click();

		// Preview video: the redesigned field has a URL input (plus a hidden
		// file input), so target the YouTube URL input by its placeholder.
		await page
			.locator("label")
			.filter({ hasText: "Preview video" })
			.locator("xpath=..")
			.getByPlaceholder("Paste a YouTube link")
			.fill("https://www.youtube.com/embed/-LPmw2Znl2c");

		// Tags. A new tag is the `Create "<tag>"` option CourseDetailsSection
		// adds once the query reaches it, and reka only highlights that option
		// a tick later, so an Enter pressed straight after typing can select
		// nothing. Click the option itself, then wait for the trigger to list
		// the tag before typing the next one.
		const tagsTrigger = page
			.locator("label")
			.filter({ hasText: "Tags" })
			.locator("xpath=..")
			.locator("button")
			.first();
		await tagsTrigger.click();
		const tagInput = page.locator(
			'[data-slot="content-body"] [data-slot="input"]'
		);
		const added: string[] = [];
		for (const tag of ["Learning", "Frappe", "ERPNext"]) {
			await tagInput.fill(tag);
			await page.getByRole("option", { name: `Create "${tag}"` }).click();
			added.push(tag);
			await expect(tagsTrigger).toHaveText(added.join(", "));
		}
		await page.keyboard.press("Escape");

		await button(page, "Save").click();
		// Save writes the whole doc, published flag included, and reloads it
		// afterwards. Publishing while that is in flight lets the stale copy
		// land last, so wait for the save and start publish from a fresh page.
		await expect(page.getByText("Course updated successfully")).toBeVisible();
		await page.reload();
		await closeOnboardingModal(page);

		// Publish
		await page
			.locator("header")
			.getByRole("button", { name: /^Publish$/ })
			.click();
		// Not the toast: its wording reads `published` when the request returns,
		// and a reload already in flight can carry the new value, so a successful
		// publish can say "Course unpublished". The button flips only once a
		// reload has returned the course as published.
		await expect(
			page.locator("header").getByRole("button", { name: /^Unpublish$/ })
		).toBeVisible({ timeout: 20000 });

		// Reload and verify published state
		await page.reload();
		await closeOnboardingModal(page);
		await expect(page.locator("header").getByText(/^Published$/)).toBeVisible({
			timeout: 10000,
		});
		await expect(
			page.locator("header").getByRole("button", { name: /^Unpublish$/ })
		).toBeVisible();
	});

	test("adds a chapter and a lesson", async ({ page }) => {
		const outlineResponse = waitForApiCall(
			page,
			"/api/method/lms.lms.utils.get_course_outline",
			20000
		);
		await page.goto(`/lms/courses/${courseSlug}`);
		await closeOnboardingModal(page);
		await page
			.getByRole("button")
			.or(page.getByRole("tab"))
			.filter({ hasText: "Course editor" })
			.click();
		await closeOnboardingModal(page);
		await outlineResponse;

		// A course without chapters shows one empty state in place of the
		// chapters panel and its toolbar; its "Create chapter" is the only way
		// in, and it waits on the course as well as the outline.
		const createChapter = page.getByRole("button", { name: "Create chapter" });
		await expect(createChapter).toBeVisible({ timeout: 20000 });

		// Scope to the chapter dialog by its Title field. The onboarding
		// "Getting started" panel is also a dismissable layer, but it has no
		// Title input.
		await createChapter.click();
		const chapterDialog = page
			.locator("[data-dismissable-layer]")
			.filter({ has: page.locator("label", { hasText: "Title" }) });
		await expect(chapterDialog).toBeVisible();
		await chapterDialog
			.locator("label")
			.filter({ hasText: "Title" })
			.locator("xpath=..")
			.locator("input")
			.fill("Test Chapter");
		// ChapterForm.vue is a form route now, and a new chapter submits with
		// "Add".
		await chapterDialog.getByTestId("chapter-save").click();
		// exact: the editor's next empty state names the chapter in a sentence.
		await expect(page.getByText("Test Chapter", { exact: true })).toBeVisible({
			timeout: 15000,
		});

		// The onboarding help modal re-expands when the chapter step completes.
		// Dismiss it before adding a lesson so it can't hijack the editor.
		await closeOnboardingModal(page);

		// "Add Lesson" opens an empty draft with the title focused; nothing is
		// created until a title is typed. The lesson is created after 3 s of
		// idle typing (or on blur) and then shows in the outline.
		await button(page, "Add Lesson").click({ timeout: 10000 });
		const titleField = page.locator("textarea.lesson-title");
		await expect(page.getByTestId("outline-draft-lesson")).toBeVisible({
			timeout: 15000,
		});
		await expect(titleField).toHaveValue("");
		const createResponse = waitForApiCall(
			page,
			"/api/method/lms.lms.api.create_lesson",
			15000
		);
		await titleField.fill("Test Lesson");
		await createResponse;
		await expect(
			page.getByTestId("outline-lesson").filter({ hasText: "Test Lesson" })
		).toBeVisible({ timeout: 15000 });

		// Regression: deleting the lesson open in the editor must drop back to
		// the empty "choose a lesson" state. Add a throwaway lesson, delete it
		// (the last row, just added), and assert the editor cleared and "Test
		// Lesson" survived.
		await button(page, "Add Lesson").click({ timeout: 10000 });
		await expect(titleField).toHaveValue("");
		const throwawayResponse = waitForApiCall(
			page,
			"/api/method/lms.lms.api.create_lesson",
			15000
		);
		await titleField.fill("Throwaway lesson");
		await titleField.blur();
		await throwawayResponse;
		await expect(
			page.getByTestId("outline-lesson").filter({ hasText: "Throwaway lesson" })
		).toBeVisible({ timeout: 15000 });
		await page
			.getByTestId("outline-lesson")
			.last()
			.locator(".lucide-trash-2")
			.click({ force: true });
		await expect(page.getByText("Delete this lesson?")).toBeVisible();
		await page
			.locator("[data-dismissable-layer]")
			.getByRole("button", { name: "Delete" })
			.click();
		await expect(page.getByText("Lesson deleted successfully")).toBeVisible();
		await expect(page.getByText("Pick a lesson to edit")).toBeVisible();
		await expect(page.getByTestId("outline-lesson")).toHaveCount(1);
		await expect(
			page.getByTestId("outline-lesson").filter({ hasText: "Test Lesson" })
		).toBeVisible();
	});

	test("verifies the course overview", async ({ page }) => {
		await page.goto(`/lms/courses/${courseSlug}`);
		await closeOnboardingModal(page);

		await expect(page).toHaveURL(new RegExp(`/lms/courses/${courseSlug}`), {
			timeout: 10000,
		});
		await expect(page.getByText(courseTitle).first()).toBeVisible();
		await expect(
			page.getByText("Test Course Short Introduction to test the UI")
		).toBeVisible();
		// Scoped to the Overview panel: an unscoped getByText("Learning") also
		// matches the sidebar brand button, whose own fallback text is literally
		// "Learning" on a site with no custom brand name set.
		await expect(
			page.getByLabel("Overview").getByText("Learning")
		).toBeVisible();
		await expect(page.locator("iframe").first()).toHaveAttribute(
			"src",
			"https://www.youtube.com/embed/-LPmw2Znl2c"
		);
		// Chapter shows in the course content (the lesson was verified in the
		// editor outline in the previous test).
		await expect(page.getByText("Test Chapter")).toBeVisible({
			timeout: 15000,
		});
	});

	test("deletes the course", async ({ page }) => {
		await page.goto(`/lms/courses/${courseSlug}`);
		await closeOnboardingModal(page);

		await settingsTab(page).click();

		await page
			.locator("header")
			.locator('button[aria-haspopup="menu"]')
			.first()
			.click({ force: true, timeout: 10000 });
		await page
			.locator("div[role=menu]")
			.getByRole("menuitem", { name: "Delete" })
			.click();
		await page.locator("span").filter({ hasText: "Delete" }).first().click();

		await expect(page).toHaveURL(/\/lms\/courses(\/|\?|$)/, { timeout: 10000 });
		await expect(page.getByText(courseTitle)).toHaveCount(0);
	});
});
