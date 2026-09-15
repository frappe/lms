import { test as setup } from "@playwright/test";
import { authFile } from "./config";

// Every spec used to call cy.login() before nearly every `it()`, re-
// authenticating dozens of times per run for no reason — Cypress can only
// run one spec file at a time anyway, so nothing was ever gained by it. This
// runs once per shard: the storage state it writes is shared read-only by
// every spec via playwright.config.ts's `e2e` project, and specs that need
// their own fixtures (a course, a quiz, an instructor) create and tear those
// down themselves in `test.beforeAll`/`afterAll`.
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

	await request.storageState({ path: authFile });
});
