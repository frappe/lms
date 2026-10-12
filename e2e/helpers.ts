import type { Page } from "@playwright/test";

// Ported from cypress/support/commands.js's closeOnboardingModal. The
// onboarding panel is OnboardingFlowPanel.vue, which reopens on load while a
// started flow is unfinished.
export async function closeOnboardingModal(page: Page) {
	const panel = page.getByTestId("onboarding-flow-panel");

	// The panel mounts only after the user resource resolves and the
	// onboarding status returns, which can land after a fixed sleep would
	// have given up. Bounded because a site with no unfinished flow never
	// opens it.
	const appeared = await panel
		.waitFor({ state: "visible", timeout: 2000 })
		.then(() => true)
		.catch(() => false);
	if (!appeared) return;

	await panel.getByRole("button", { name: "Close" }).click({ force: true });
	await panel.waitFor({ state: "detached" });
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
