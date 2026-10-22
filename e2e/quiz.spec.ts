import { test, expect } from "./fixtures";
import { button, deleteLeftovers } from "./helpers";
import { authFile, baseURL } from "./config";
import type { Browser, Page } from "@playwright/test";

let quizName: string;
// Unique per run: two decades of leftover "Cypress Test Quiz"/"What is 2 + 2?"
// docs already sit in this dev DB from prior sessions (API-seeded runs whose
// afterAll never got to run), and the question-bank cleanup below searches by
// this text — an ambiguous match would select every leftover row, not just
// this run's.
const runToken = Date.now();
const quizTitle = `Cypress Test Quiz ${runToken}`;
const questionText = `What is 2 + 2? (${runToken})`;

// test.beforeAll/afterAll run outside any single test and so don't get the
// test-scoped `page` fixture; a real page is created from the worker-scoped
// `browser` fixture instead, reusing the same logged-in session
// global.setup.ts already established.
async function withPage(
	browser: Browser,
	fn: (page: Page) => Promise<void>
): Promise<void> {
	const context = await browser.newContext({ storageState: authFile, baseURL });
	const page = await context.newPage();
	try {
		await fn(page);
	} finally {
		await context.close();
	}
}

// frappe-ui's FormControl doesn't reliably wire `for`/`id` to its <label>, so
// course_creation.spec.ts already scopes by the label's own text instead of
// trusting getByLabel — same pattern here.
function labeledField(page: Page, label: string | RegExp) {
	return page
		.locator("label")
		.filter({ hasText: label })
		.locator("xpath=..")
		.locator("input, textarea");
}

// Select-all on a list the page has narrowed to one row. The list only shows
// the header's checkbox plus one per row, so a count of two means the filter or
// the debounced search has landed; selecting any earlier would select whatever
// the unfiltered list still shows.
async function selectOnlyRow(page: Page) {
	const checkboxes = page.locator('input[type="checkbox"]');
	await expect(checkboxes).toHaveCount(2);
	await checkboxes.first().click();
}

test.describe("Quiz", () => {
	// Each test builds on the one before, down to deleting what they made, and
	// quizName lives only in the worker whose beforeAll set it. Serial retries
	// the whole chain from a fresh quiz instead of one test against a stale one.
	test.describe.configure({ mode: "serial" });

	// The last two tests delete all of this through the UI; this catches a chain
	// that failed before them. Submissions first: LMS Quiz refuses to go while
	// one links to it.
	test.afterAll(async () => {
		await deleteLeftovers([
			{ doctype: "LMS Quiz Submission", filters: { quiz: quizName } },
			{ doctype: "LMS Quiz", name: quizName },
			{
				doctype: "LMS Question",
				filters: { question: ["like", `%(${runToken})%`] },
			},
		]);
	});

	// Seeds the quiz + question through the real authoring UI (/quizzes/new)
	// instead of frappe.client.insert: this is a UI test, and QuizForm.vue's
	// own flow is exactly what a real moderator would use to build one.
	test.beforeAll(async ({ browser }, testInfo) => {
		// Real page loads through /quizzes/new, /quizzes/edit, /quizzes/submissions
		// and /quizzes/questions add up to more than the default 30s hook budget
		// under CI's slower, more contended environment (this timed out there,
		// never locally). 90s matches roughly 3x this session's own local runtime.
		testInfo.setTimeout(90000);
		await withPage(browser, async (page) => {
			await page.goto("/lms/quizzes/new");

			// Naming the quiz is what inserts the LMS Quiz doc (QuizForm.vue's
			// createIfNamed, fired on the title field's blur).
			const title = labeledField(page, "Title");
			await title.fill(quizTitle);
			await title.blur();
			await page.waitForURL(/\/lms\/quizzes\/edit\//);
			quizName = page.url().split("/").pop() as string;

			await labeledField(page, "Passing Percentage").fill("60");

			// A brand-new quiz also renders "New question" inside the empty-state
			// panel below the toolbar; scope to the toolbar's own copy.
			await page
				.getByTestId("question-toolbar")
				.getByRole("button", { name: "New question" })
				.click();
			const draft = page.getByTestId("draft-card");

			// TipTap's own DOM sync picks up a direct textContent write; matches
			// the identical pattern course_creation.spec.ts already uses for the
			// course description's rich-text field.
			await draft.locator("div.ProseMirror").evaluate((el, text) => {
				el.textContent = text;
			}, questionText);

			// Choices/single is the default type for a quiz's first question, with
			// two required options — only as many as the assertions below need.
			// `exact` matters: "Option 1" is otherwise a substring match of the
			// sibling "Explanation for option 1" field's own accessible name.
			await draft
				.getByRole("textbox", { name: "Option 1", exact: true })
				.fill("3");
			await draft
				.getByRole("textbox", { name: "Option 2", exact: true })
				.fill("4");
			await draft
				.getByRole("radio", { name: "Option 2 is the correct answer" })
				.check();

			await button(page, "Save question").click();
			await draft.waitFor({ state: "detached" });

			// Adding the question and editing Passing Percentage both dirty the
			// quiz doc; QuizForm.vue autosaves it, but silently (`notify: false`)
			// — Ctrl+S (its own shared save shortcut) is the one path that both
			// forces an immediate save and confirms it with a toast to wait on.
			const saveToast = page.getByText("Quiz updated successfully");
			await page.keyboard.press("Control+s");
			await saveToast.waitFor();
		});
	});

	test.describe("multiple choice quiz", () => {
		test("shows quiz info on the start screen", async ({ page }) => {
			await page.goto(`/lms/quiz/${quizName}`);

			await expect(page.getByText(quizTitle).first()).toBeVisible();

			// The start screen's stats grid pairs each <dt> label with its <dd>.
			const stat = (label: string) =>
				page
					.locator("dl > div")
					.filter({ has: page.getByText(label, { exact: true }) })
					.locator("dd");
			await expect(stat("Questions")).toHaveText("1");
			await expect(stat("Pass mark")).toHaveText("60%");
		});

		test("starts the quiz and shows the question with answer choices", async ({
			page,
		}) => {
			await page.goto(`/lms/quiz/${quizName}`);

			const start = button(page, "Start Quiz");
			await expect(start).toBeEnabled();
			await start.click();

			await expect(page.getByText("What is 2 + 2?")).toBeVisible({
				timeout: 10000,
			});
			await expect(page.getByRole("radio").first()).toBeVisible();
		});

		test("submits the quiz and shows the result", async ({ page }) => {
			await page.goto(`/lms/quiz/${quizName}`);

			await button(page, "Start Quiz").click();

			// Select any answer. frappe-ui's Radio is a `role="radio"` button, not a
			// native input, so `.check()` does not apply to it.
			await page.getByRole("radio").first().click({ timeout: 10000 });

			const submitQuiz = page.waitForResponse(
				(res) =>
					res
						.url()
						.includes(
							"/api/method/lms.lms.doctype.lms_quiz.lms_quiz.submit_quiz"
						) && res.request().method() === "POST",
				{ timeout: 15000 }
			);

			// show_answers defaults to 1 on LMS Quiz, so a choice question offers
			// Check before it offers Submit. Submit only replaces it once the
			// answer has been revealed.
			await button(page, "Check").click();
			await button(page, "Submit").click();
			await submitQuiz;

			// The result leads with a Passed or Failed badge, then the marks.
			await expect(page.getByTestId("quiz-verdict")).toBeVisible({
				timeout: 10000,
			});
			await expect(page.getByText(/of \d+ marks/)).toBeVisible();
		});

		// LMS Quiz refuses to delete while a submission links to it
		// (LinkExistsError), so the one the test above made goes first.
		test("deletes the submission", async ({ page }) => {
			await page.goto(`/lms/quizzes/submissions?quiz=${quizName}`);
			await selectOnlyRow(page);
			await button(page, "Delete").click();
			await expect(
				page.getByText("Submissions deleted successfully")
			).toBeVisible();
			// The empty state's description: its title is echoed into a status
			// region for screen readers, so matching that would find two.
			await expect(
				page.getByText("There are no quiz submissions currently.")
			).toBeVisible();
		});

		test("deletes the quiz and its question", async ({ page }) => {
			await page.goto(`/lms/quizzes/edit/${quizName}`);
			await button(page, "Delete").click();
			const dialog = page
				.getByRole("dialog")
				.filter({ hasText: "Delete this quiz?" });
			await dialog.getByRole("button", { name: "Delete" }).click();
			await expect(page.getByText("Quiz deleted successfully")).toBeVisible();
			await page.waitForURL(/\/lms\/quizzes$/);

			// The question bank record outlives the quiz (it's a shared, separately
			// owned doctype), so delete it the way a moderator tidying the question
			// bank would: search it out, select it, bulk-delete.
			await page.goto("/lms/quizzes/questions");
			await page.getByRole("textbox", { name: "Search" }).fill(questionText);
			await selectOnlyRow(page);
			await button(page, "Delete").click();
			await expect(
				page.getByText("Question deleted successfully")
			).toBeVisible();
			// The search box still holds the question text, so the empty state
			// names the search rather than claiming the bank is empty.
			await expect(
				page.getByText(`Nothing matches "${questionText}"`)
			).toBeVisible();
		});
	});
});
