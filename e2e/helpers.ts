import type { APIRequestContext, Page } from "@playwright/test";

// Ported from cypress/support/commands.js's closeOnboardingModal. Force-
// clicks the header X, which the modal's own transitions can otherwise
// detach mid-wait.
export async function closeOnboardingModal(page: Page) {
	const modal = page.getByTestId("onboarding-help-modal");

	// The modal mounts only after the user resource resolves and an
	// onboarding-status API call returns, which can land after a fixed sleep
	// would have already given up and moved on — leaving it to pop up later,
	// mid-test. Waiting on the element itself is the correct condition; it's
	// bounded because a returning user with onboarding already complete never
	// gets one.
	const appeared = await modal
		.waitFor({ state: "visible", timeout: 2000 })
		.then(() => true)
		.catch(() => false);
	if (!appeared) return;

	// @framework/ui's HelpModal.vue (Onboarding/HelpModal.vue) renders the
	// close icon as `<LucideX class="size-3.5" />`, an inline SVG imported
	// via unplugin-icons (`~icons/lucide/x`) — it carries neither a
	// feather-x nor a lucide-x class, so a class-based selector never
	// matches. The header (the modal's first div) always ends with the
	// close button: an optional overflow-menu button, then minimize, then
	// close, in that fixed order.
	await modal
		.locator("div")
		.first()
		.getByRole("button")
		.last()
		.click({ force: true });
	await modal.waitFor({ state: "detached" });
}

export function button(page: Page, name: string | RegExp) {
	return page.getByRole("button", { name });
}

// Ported from cypress's cy.intercept().as() + cy.wait('@alias') pairs.
// Must be called BEFORE the action that triggers the request (it returns a
// promise to await afterwards), same as page.waitForResponse itself.
export function waitForApiCall(
	page: Page,
	urlSubstring: string,
	timeout = 15000
) {
	return page.waitForResponse(
		(res) =>
			res.url().includes(urlSubstring) && res.request().method() === "POST",
		{ timeout }
	);
}

// /lms renders the session's CSRF token into its boot script, minting one if
// the session has none yet (lms/www/_lms.py get_boot).
export async function csrfToken(request: APIRequestContext) {
	const html = await (await request.get("/lms")).text();
	const token = html.match(/window\["csrf_token"\] = "([^"]+)"/)?.[1];
	if (!token) throw new Error("/lms rendered no CSRF token");
	return token;
}
