import { request as playwrightRequest } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { authFile, baseURL } from "./config";

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
type Filters = Record<string, string | [string, string] | undefined>;
type Leftover =
	| { doctype: string; name?: string; filters?: Filters }
	| { method: string; args: Record<string, string | undefined> };

// The safety net behind each spec's own UI deletes: when a chain fails before
// reaching them, afterAll removes what it left through the API instead. Best
// effort by design, in the order given (links first), and never throws: a
// cleanup that fails would bury the failure that made it run.
export async function deleteLeftovers(leftovers: Leftover[]) {
	const api = await playwrightRequest.newContext({
		baseURL,
		storageState: authFile,
	});
	try {
		const headers = { "X-Frappe-CSRF-Token": await csrfToken(api) };
		const post = (method: string, form: Record<string, string>) =>
			api.post(`/api/method/${method}`, { headers, form });
		for (const leftover of leftovers) {
			if ("method" in leftover) {
				// An arg is unset when the chain failed before creating the doc.
				if (Object.values(leftover.args).every(Boolean)) {
					await post(leftover.method, leftover.args as Record<string, string>);
				}
				continue;
			}
			const { doctype, name, filters } = leftover;
			// An unset filter value would drop out of the JSON and match every row.
			const names = name
				? [name]
				: filters && Object.values(filters).every(Boolean)
				? await listNames(api, doctype, filters)
				: [];
			for (const docname of names) {
				await post("frappe.client.delete", { doctype, name: docname });
			}
		}
	} catch {
		// Nothing to do: see above.
	} finally {
		await api.dispose();
	}
}

async function listNames(
	api: APIRequestContext,
	doctype: string,
	filters: Filters
) {
	const response = await api.get("/api/method/frappe.client.get_list", {
		params: {
			doctype,
			filters: JSON.stringify(filters),
			fields: JSON.stringify(["name"]),
			limit_page_length: "0",
		},
	});
	const { message } = (await response.json()) as {
		message?: { name: string }[];
	};
	return (message ?? []).map((row) => row.name);
}
