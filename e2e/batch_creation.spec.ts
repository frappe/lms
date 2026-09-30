import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { closeOnboardingModal, button, waitForApiCall } from "./helpers";

const dateNow = Date.now();
const randomEvaluator = `evaluator${dateNow}@example.com`;

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
	// Exact match, not a substring: on a fresh site with zero batches,
	// EmptyStateLayout's "...fresh learning experiences are on the way!"
	// also contains "learning" (hasText on a string is case-insensitive),
	// so an unanchored match resolves to two elements.
	await page
		.locator("span")
		.filter({ hasText: /^\s*Learning\s*$/ })
		.click();
	await page.getByRole("menuitem", { name: "Settings" }).click();
	await page
		.locator("[data-dismissable-layer]")
		.locator("button")
		.filter({ hasText: "Users" })
		.click();
};

test.describe("Batch Creation", () => {
	test("creates an evaluator via Users settings", async ({ page }) => {
		await page.goto("/lms/batches");
		await closeOnboardingModal(page);

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
		// second dialog on top of the settings one, and its submit says "Save".
		// Two stacked dismissable layers make a label search ambiguous, so go
		// by the form's own test id.
		const userInsert = waitForApiCall(page, "/api/method/frappe.client.insert");
		const saveRole = waitForApiCall(page, "/api/method/lms.lms.api.save_role");
		await page.getByTestId("member-save").click();
		await userInsert;
		await saveRole;

		// Modal closes on success
		await expect(page.getByText("Add New Member")).toHaveCount(0);

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
		const randomStudent = `testuser_${Date.now()}@example.com`;

		await page.goto("/lms/batches");
		await closeOnboardingModal(page);

		// The Enrol dialog's Student field is a User link that searches
		// existing users, so the student must exist before we can enrol them.
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
		const studentInsert = waitForApiCall(
			page,
			"/api/method/frappe.client.insert"
		);
		await page.getByTestId("member-save").click();
		await studentInsert;
		await expect(page.getByText("Add New Member")).toHaveCount(0);

		// Back to the batch list to create the batch.
		await page.goto("/lms/batches");
		await closeOnboardingModal(page);

		// Create batch
		await button(page, "Create").click();
		await page.getByRole("menuitem", { name: "New Batch" }).click();

		const field = (label: string) =>
			page.locator("label").filter({ hasText: label }).locator("xpath=..");

		await field("Title").locator("input").fill("Test Batch");
		await field("Start Date").locator("input").fill("2030-10-01");
		await field("End Date").locator("input").fill("2030-10-31");
		await field("Start Time").locator("input").fill("10:00");
		await field("End Time").locator("input").fill("11:00");

		// Timezone picker
		const tzInput = field("Timezone").locator("input");
		await tzInput.click();
		await tzInput.fill("Asia/Kol");
		const tzListId = await tzInput.getAttribute("aria-controls");
		const tzList = page.locator(`[id^="${tzListId}"]`);
		await expect(tzList).toBeVisible();
		await tzList.locator("[data-slot=item]").first().click();

		await field("Seat Count").locator("input").fill("10");
		await field("Description")
			.locator("textarea")
			.fill("Test Batch Short Description to test the UI");

		await page.locator("div.ProseMirror").click();
		await page
			.locator("div.ProseMirror")
			.pressSequentially(
				"Test Batch Description. I need a very big description to test the UI. This is a very big description."
			);

		// Pick the evaluator as instructor. MultiLink renders both a hidden
		// headlessui combobox button and the visible trigger button, so target
		// the visible one (.first() would grab the hidden one and fail).
		await field("Instructors").locator("button:visible").first().click();
		const instructorInput = page.locator(
			'[data-slot="content-body"] [data-slot="input"]'
		);
		await instructorInput.fill(randomEvaluator);
		// The option shows the user's name, not the email; typing the full
		// unique email filters the list to the single matching evaluator.
		const instructorOption = page.locator(
			'[data-slot="content-body"] [role="option"]'
		);
		await expect(instructorOption).toHaveCount(1, { timeout: 10000 });
		await instructorOption.first().click();
		await page.keyboard.press("Escape");

		await button(page, "Save").click();

		// Verify redirect to settings
		await expect(page).toHaveURL(/#settings/, { timeout: 10000 });
		await closeOnboardingModal(page);

		// Publish
		await button(page, "Publish").click();
		await expect(page.getByText(/Batch published/i)).toBeVisible({
			timeout: 10000,
		});
		await expect(button(page, "Unpublish")).toBeVisible();

		// Capture batch slug
		const batchName = page.url().split("/").pop()!.split("#")[0];

		// View batch card in list
		await page.goto("/lms/batches");
		await closeOnboardingModal(page);
		await expect(page).toHaveURL(/\/lms\/batches/);
		await page.getByRole("radio", { name: "Upcoming" }).click();

		const batchLink = page.locator(`a[href='/lms/batches/${batchName}']`);
		await expect(batchLink).toBeVisible({ timeout: 10000 });
		await expect(batchLink.getByText("Test Batch").first()).toBeVisible();
		await expect(
			batchLink.getByText("Test Batch Short Description to test the UI")
		).toBeVisible();
		await expect(
			batchLink.getByText("01 Oct 2030 - 31 Oct 2030")
		).toBeVisible();
		await expect(batchLink.getByText("10:00 AM - 11:00 AM")).toBeVisible();
		await expect(batchLink.getByText("Asia/Kolkata")).toBeVisible();
		await expect(batchLink.getByText("Evaluator")).toBeVisible();
		await expect(batchLink.getByText("10 Seats Left")).toBeVisible();
		await batchLink.click();

		// Batch detail page
		await expect(page.getByText("Test Batch").first()).toBeVisible({
			timeout: 10000,
		});
		await expect(
			page.getByText("Test Batch Short Description to test the UI")
		).toBeVisible();
		await expect(page.getByText("Evaluator")).toBeVisible();
		// BatchOverview renders BatchOverlay twice for responsive layouts: a
		// mobile copy (md:hidden, first in the DOM) and a desktop copy (hidden
		// md:block). A plain text locator matches the first DOM node, i.e. the
		// mobile copy, which is display:none on the desktop test viewport —
		// scope these assertions to the visible overlay.
		const overlay = page
			.locator(".border-2.rounded-md.lg\\:w-72:visible")
			.first();
		await expect(overlay.getByText("01 Oct 2030 - 31 Oct 2030")).toBeVisible();
		await expect(overlay.getByText("10:00 AM - 11:00 AM")).toBeVisible();
		await expect(overlay.getByText("Asia/Kolkata")).toBeVisible();
		await expect(overlay.getByText("10 Seats Left")).toBeVisible();
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
		await closeOnboardingModal(page);
		await button(page, "Enroll").click();
		const enrollDialog = page.locator('div[role="dialog"]').first();
		const studentField = enrollDialog
			.locator("label")
			.filter({ hasText: "Student" })
			.locator("xpath=..")
			.locator("input");
		await studentField.click();
		await studentField.fill(randomStudent);
		// See course_creation.spec.ts's instructor-search click for why this
		// needs the combined find+actionability budget, not just the find half.
		await page.locator("[data-slot=item]").first().click({ timeout: 30000 });
		// Enrolling is a form route now (BatchStudentForm.vue) and every form
		// in the shell submits with "Save".
		await page.getByTestId("batch-student-save").click();

		// Verify seat count (scope to the visible overlay; the mobile
		// md:hidden copy is first in the DOM but display:none on this
		// viewport).
		await page
			.getByRole("button")
			.or(page.getByRole("tab"))
			.filter({ hasText: "Overview" })
			.click();
		const overlayAfterEnroll = page
			.locator(".border-2.rounded-md.lg\\:w-72:visible")
			.first();
		await expect(overlayAfterEnroll.getByText("9 Seats Left")).toBeVisible({
			timeout: 10000,
		});
	});
});
