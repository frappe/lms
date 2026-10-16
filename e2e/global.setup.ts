import fs from "node:fs";
import path from "node:path";
import { test as setup } from "@playwright/test";
import { authFile, baseURL } from "./config";
import { csrfToken } from "./helpers";

// Every spec used to call cy.login() before nearly every `it()`, re-
// authenticating dozens of times per run for no reason — Cypress can only
// run one spec file at a time anyway, so nothing was ever gained by it. This
// runs once per run: the storage state it writes is shared read-only by
// every spec via playwright.config.ts's `e2e` project, and specs that need
// their own fixtures (a course, a quiz, an instructor) create those
// themselves in `test.beforeAll`.
setup("authenticate", async ({ request }) => {
	const user = process.env.PLAYWRIGHT_TEST_USER || "frappe@example.com";
	const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "admin";

	// Playwright's APIRequestContext doesn't fail-on-status-code the way
	// Cypress's cy.request() does by default: an unchecked 401 here would
	// still write an unauthenticated admin.json, and every spec sharing it
	// would then fail downstream with confusing symptoms (redirected to
	// /login, elements not found) instead of one clear setup failure.
	const response = await request.post("/api/method/login", {
		form: { usr: user, pwd: password },
	});
	if (!response.ok()) {
		throw new Error(
			`Login as ${user} failed: ${response.status()} ${await response.text()}`
		);
	}

	// Login leaves the session without a CSRF token; the first page render
	// mints one (frappe.sessions.get_csrf_token). Left to the specs, two
	// workers opening /lms at once on this shared session each minted their
	// own, the later write won, and the other page failed every POST with
	// CSRFTokenError. Minting it here, before any worker starts, means every
	// page reuses the same token.
	await csrfToken(request);

	// The onboarding help modal opens on every fresh page until the browser
	// remembers the checklist as done, and it covers what the specs click.
	const state = await request.storageState();
	state.origins.push({
		origin: new URL(baseURL).origin,
		localStorage: [
			{ name: `isOnboardingStepsCompletedlearning${user}`, value: "true" },
		],
	});
	fs.mkdirSync(path.dirname(authFile), { recursive: true });
	fs.writeFileSync(authFile, JSON.stringify(state));
});
