import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { button, deleteLeftovers, waitForApiCall } from "./helpers";

const dateNow = Date.now();
const randomEvaluator = `evaluator${dateNow}@example.com`;
// Set by the batch test, for afterAll to clean up.
let randomStudent: string | undefined;
let batchName: string | undefined;

// Settings > Users renders its own member form, whose placeholders are not
// the standalone /lms member form's. The label is the stable handle:
// frappe-ui's FormControl points it at the input's id.
const fillMemberField = async (page: Page, label: string, value: string) => {
	const forId = await page
		.locator("[data-dismissable-layer]")
		.locator("label", { hasText: label })
		.getAttribute("for");
	await page.locator(`[id="${forId}"]`).fill(value);
};

const openUsersSettings = async (page: Page) => {
	// The header's title is the site's app name when one is set, so locate
	// it by frappe-ui's slot marker instead.
	await page
		.getByRole("navigation", { name: "Main" })
		.locator('[data-slot="sidebar-header"] button')
		.click();
	await page.getByRole("menuitem", { name: "Settings" }).click();
	await page
		.locator("[data-dismissable-layer]")
		.locator("button")
		.filter({ hasText: "Users" })
		.click();
};

test.describe("Batch Creation", () => {
	// The batch test assigns the evaluator the first test creates, and
	// randomEvaluator is regenerated in every new worker. Serial retries both
	// together.
	test.describe.configure({ mode: "serial" });

	// No UI flow here deletes a batch or a user, so the API does it, links
	// first: the enrolment holds the batch, and the batch and the evaluator
	// record hold the users.
	test.afterAll(async () => {
		await deleteLeftovers([
			{ doctype: "LMS Batch Enrollment", filters: { batch: batchName } },
			{ doctype: "LMS Batch", name: batchName },
			{ doctype: "Course Evaluator", name: randomEvaluator },
			{ doctype: "User", name: randomEvaluator },
			{ doctype: "User", name: randomStudent },
		]);
	});

	test("creates an evaluator via Users settings", async ({ page }) => {
		await page.goto("/lms/batches");

		await openUsersSettings(page);

		// Create evaluator via New button
		await page
			.locator("[data-dismissable-layer]")
			.locator("button")
			.filter({ hasText: "New" })
			.click();

		await fillMemberField(page, "Email", randomEvaluator);
		await fillMemberField(page, "First Name", "Evaluator");

		// Toggle Evaluator role. frappe-ui's Switch renders a <label for=id>
		// linked to the switch button's id, so toggle via that association
		// (the role name is not wrapped in a <label> ancestor).
		const roleForId = await page
			.locator("[data-dismissable-layer]")
			.locator("label", { hasText: "Evaluator" })
			.getAttribute("for");
		await page.locator(`[id="${roleForId}"]`).click();

		// The member form is its own route now (MemberForm.vue), rendered as a
		// second dialog on top of the settings one, and its submit says "Create".
		// Two stacked dismissable layers make a label search ambiguous, so go
		// by the form's own test id.
		const memberAdd = waitForApiCall(
			page,
			"/api/method/lms.lms.api.add_member"
		);
		const saveRole = waitForApiCall(page, "/api/method/lms.lms.api.save_role");
		await page.getByTestId("member-save").click();
		await memberAdd;
		await saveRole;

		// Modal closes on success
		await expect(page.getByText("New Member", { exact: true })).toHaveCount(0);

		// Filter by Evaluator role to verify
		await page
			.locator("[data-dismissable-layer]")
			.locator("button[role='combobox']")
			.click();
		await page
			.locator('[role="listbox"]')
			.getByText("Evaluator")
			.click({ timeout: 10000 });
		await expect(
			page.locator("[data-dismissable-layer]").getByText(randomEvaluator)
		).toBeVisible({ timeout: 10000 });
	});

	test("creates and verifies a new batch", async ({ page }) => {
		// Unique per attempt: on a retry the previous attempt's user already
		// exists, and re-adding it leaves the member modal open (insert errors).
		randomStudent = `testuser_${Date.now()}@example.com`;

		await page.goto("/lms/batches");

		// The Enroll Students picker searches existing users, so the student
		// must exist before we can enrol them.
		// Create it via Users settings (mirrors the evaluator setup, without a
		// role).
		await openUsersSettings(page);
		await page
			.locator("[data-dismissable-layer]")
			.locator("button")
			.filter({ hasText: "New" })
			.click();
		await fillMemberField(page, "Email", randomStudent);
		await fillMemberField(page, "First Name", "Student");
		const studentAdd = waitForApiCall(
			page,
			"/api/method/lms.lms.api.add_member"
		);
		await page.getByTestId("member-save").click();
		await studentAdd;
		await expect(page.getByText("New Member", { exact: true })).toHaveCount(0);

		// Back to the batch list to create the batch.
		await page.goto("/lms/batches");

		// Create batch. The header's: an empty list offers its own New Batch.
		await page
			.locator("header")
			.getByRole("button", { name: "New Batch" })
			.click();
		await page.waitForURL(/\/lms\/batches\/new$/);

		// A new batch is its own page (NewBatchPage.vue): the batch overview,
		// edited in place, saved once with Save.
		const main = page.getByRole("main");
		await main.getByRole("textbox", { name: "Batch title" }).fill("Test Batch");
		await main
			.getByRole("textbox", { name: /^Short description/ })
			.fill("Test Batch Short Description to test the UI");

		// Pick the evaluator as instructor. Typing the full unique email filters
		// the list to the single matching evaluator; the option shows the user's
		// name, not the email.
		await main.getByRole("button", { name: "Add instructors" }).click();
		await page
			.locator('[data-slot="content-body"] [data-slot="input"]')
			.fill(randomEvaluator);
		const instructorOption = page.locator(
			'[data-slot="content-body"] [role="option"]'
		);
		await expect(instructorOption).toHaveCount(1, { timeout: 10000 });
		await instructorOption.first().click();
		await page.keyboard.press("Escape");

		// The enrol card's facts. The pickers take typed values, committed on
		// Enter.
		const dates = main.getByRole("combobox", { name: "Start and end dates" });
		await dates.fill("2030-10-01 to 2030-10-31");
		await dates.press("Enter");
		const startTime = main.getByRole("combobox", {
			name: "Start",
			exact: true,
		});
		await startTime.fill("10:00 am");
		await startTime.press("Enter");
		const endTime = main.getByRole("combobox", { name: "End", exact: true });
		await endTime.fill("11:00 am");
		await endTime.press("Enter");

		const timezone = main.getByRole("combobox", { name: "Timezone" });
		await timezone.fill("Asia/Kol");
		await page.getByRole("option", { name: "Asia/Kolkata" }).click();

		await main.getByRole("spinbutton", { name: "Seat count" }).fill("10");

		// Last: the details editor's toolbar hides on blur, which can move the
		// enrol card under a click aimed at it.
		await main
			.getByRole("textbox", { name: "About this batch" })
			.fill(
				"Test Batch Description. I need a very big description to test the UI. This is a very big description."
			);

		await page
			.locator("header")
			.getByRole("button", { name: "Save", exact: true })
			.click();

		// Saving opens the batch's own page. Excluding "new" is what waits for
		// the redirect rather than the draft page's own already-current URL.
		await page.waitForURL(/\/lms\/batches\/(?!new(?:$|[/?#]))[^/?#]+(#.*)?$/, {
			timeout: 10000,
		});
		batchName = new URL(page.url()).pathname.split("/").pop();

		// Publish
		const header = page.locator("header");
		await header.getByRole("button", { name: /^Publish$/ }).click();
		await expect(page.getByText(/Batch published/i)).toBeVisible({
			timeout: 10000,
		});
		await expect(header.getByText(/^Published$/)).toBeVisible();

		// View batch card in list
		await page.goto("/lms/batches");
		await expect(page).toHaveURL(/\/lms\/batches/);
		await page.getByRole("radio", { name: "Upcoming" }).click();

		// The card's title is its link, stretched over the card; the rest of the
		// card's text sits beside the link, not inside it.
		const batchLink = page.locator(`a[href='/lms/batches/${batchName}']`);
		const batchCard = page.getByRole("article").filter({ has: batchLink });
		await expect(batchLink).toBeVisible({ timeout: 10000 });
		await expect(batchLink).toHaveText("Test Batch");
		await expect(
			batchCard.getByText("Test Batch Short Description to test the UI")
		).toBeVisible();
		await expect(
			batchCard.getByText("01 Oct 2030 - 31 Oct 2030")
		).toBeVisible();
		await expect(batchCard.getByText("10:00 AM – 11:00 AM")).toBeVisible();
		await expect(batchCard.getByText("Asia/Kolkata")).toBeVisible();
		// The instructors show as one avatar group named after them.
		await expect(
			batchCard.getByRole("img", { name: "By Evaluator" })
		).toBeVisible();
		await expect(batchCard.getByText("10 Seats Left")).toBeVisible();
		await batchLink.click();

		// Batch detail page. Its overview is the edit form for the batch's
		// instructor, so the title and short description are field values.
		const detail = page.getByRole("main");
		await expect(
			detail.getByRole("textbox", { name: "Batch title" })
		).toHaveValue("Test Batch", { timeout: 10000 });
		await expect(
			detail.getByRole("textbox", { name: /^Short description/ })
		).toHaveValue("Test Batch Short Description to test the UI");
		await expect(detail.getByText("Evaluator")).toBeVisible();
		// The dates, times, timezone and seats were checked on the card above.
		await expect(
			page.getByText(
				"Test Batch Description. I need a very big description to test the UI."
			)
		).toBeVisible();

		// Enroll student. "Dashboard" is a tab, not a plain button (same
		// button-or-tab ambiguity as course_creation.spec.ts's settingsTab).
		await page
			.getByRole("button")
			.or(page.getByRole("tab"))
			.filter({ hasText: "Dashboard" })
			.click();
		// A batch with no students shows only the empty state's Enroll students;
		// the header's Enroll appears once the dashboard has data.
		await button(page, /^Enroll students$/i).click();
		// The Enroll Students dialog picks students with a MultiSelect, the same
		// trigger + content-body search as the Instructors field above. Typing
		// the unique email narrows the results to the student made above.
		const enrollDialog = page.locator('div[role="dialog"]').first();
		await enrollDialog
			.locator("label")
			.filter({ hasText: "Students" })
			.locator("xpath=..")
			.locator('[data-slot="trigger"]')
			.click();
		await page
			.locator('[data-slot="content-body"] [data-slot="input"]')
			.fill(randomStudent);
		const studentOption = page.locator(
			'[data-slot="content-body"] [role="option"]'
		);
		await expect(studentOption).toHaveCount(1, { timeout: 10000 });
		await studentOption.first().click();
		await page.keyboard.press("Escape");
		// A free batch has no payment step, so Enroll submits straight away.
		const enrolled = waitForApiCall(
			page,
			"/api/method/lms.lms.api.add_students_to_batch"
		);
		await enrollDialog.getByTestId("enroll-submit").click();
		await enrolled;

		// Enrolling takes a seat, which the batch's card counts. Back through
		// the breadcrumb: a page load would abort the dashboard's own reload.
		await page
			.locator("header")
			.getByRole("link", { name: "Batches", exact: true })
			.click();
		await page.getByRole("radio", { name: "Upcoming" }).click();
		await expect(batchCard.getByText("9 Seats Left")).toBeVisible({
			timeout: 10000,
		});
	});
});
