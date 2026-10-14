import type { APIRequestContext, Page } from "@playwright/test";

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
