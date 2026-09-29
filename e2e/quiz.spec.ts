import { test, expect } from "./fixtures";
import { closeOnboardingModal, button } from "./helpers";
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

test.describe("Quiz", () => {
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
			await closeOnboardingModal(page);

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

	// Mirrors the create flow: delete through the same Settings/authoring UI a
	// moderator would use, not a bare API call.
	test.afterAll(async ({ browser }, testInfo) => {
		// Same reasoning as beforeAll's own setTimeout above — this is the hook
		// that actually timed out in CI (30s default vs. submissions + quiz +
		// questions page cleanup, each a real page load).
		testInfo.setTimeout(90000);
		await withPage(browser, async (page) => {
			// The "submits the quiz" test above created a real LMS Quiz Submission;
			// LMS Quiz's own delete refuses while one links to it (LinkExistsError),
			// so it has to go first — same select-all-then-delete pattern as the
			// question bank cleanup below, pre-scoped to this quiz via the same
			// query param QuizForm.vue's own "Submissions" header button uses.
			await page.goto(`/lms/quizzes/submissions?quiz=${quizName}`);
			await closeOnboardingModal(page);
			const submissionCheckbox = page.locator('input[type="checkbox"]').first();
			if (await submissionCheckbox.isVisible()) {
				await submissionCheckbox.click();
				await button(page, "Delete").click();
				await expect(submissionCheckbox).toBeHidden();
			}

			await page.goto(`/lms/quizzes/edit/${quizName}`);
			await closeOnboardingModal(page);
			await button(page, "Delete").click();
			const dialog = page
				.getByRole("dialog")
				.filter({ hasText: "Delete this quiz?" });
			await dialog.getByRole("button", { name: "Delete" }).click();
			await page.waitForURL(/\/lms\/quizzes$/);

			// The question bank record outlives the quiz (it's a shared, separately
			// owned doctype) — delete it the same way a moderator tidying the
			// question bank would: search it out, select it, bulk-delete.
			await page.goto("/lms/quizzes/questions");
			await closeOnboardingModal(page);
			await page.getByRole("textbox", { name: "Search" }).fill(questionText);
			await expect(page.getByText(questionText)).toBeVisible();
			// The header's own "select all" checkbox, applied to a search result
			// narrowed to this one row, is simpler than hunting a per-row checkbox
			// that carries no accessible name of its own.
			await page.locator('input[type="checkbox"]').first().click();
			await button(page, "Delete").click();
			await expect(page.getByText(questionText)).toHaveCount(0);
		});
	});

	test.describe("multiple choice quiz", () => {
		test("shows quiz info on the start screen", async ({ page }) => {
			await page.goto(`/lms/quiz/${quizName}`);
			await closeOnboardingModal(page);

			await expect(page.getByText("Cypress Test Quiz").first()).toBeVisible();
			await expect(page.getByText("1 question")).toBeVisible();
			await expect(page.getByText("Passing score: 60%")).toBeVisible();
		});

		test("starts the quiz and shows the question with answer choices", async ({
			page,
		}) => {
			await page.goto(`/lms/quiz/${quizName}`);
			await closeOnboardingModal(page);

			const start = button(page, "Start Quiz");
			await expect(start).toBeEnabled();
			await start.click();

			await expect(page.getByText("What is 2 + 2?")).toBeVisible({
				timeout: 10000,
			});
			await expect(page.locator('input[type="radio"]').first()).toBeVisible();
		});

		test("submits the quiz and shows the result", async ({ page }) => {
			await page.goto(`/lms/quiz/${quizName}`);
			await closeOnboardingModal(page);

			await button(page, "Start Quiz").click();

			// Select any answer
			await page
				.locator('input[type="radio"]')
				.first()
				.check({ force: true, timeout: 10000 });

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

			// Result panel appears after submission
			await expect(page.getByText(/score|correct|result/i)).toBeVisible({
				timeout: 10000,
			});
		});
	});
});
