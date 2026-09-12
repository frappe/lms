import { test as base, expect } from "@playwright/test";

// Cypress fails whatever test is running the instant the page throws an
// uncaught exception — that's what turned the missing-courseName bug into a
// hard test failure instead of a silent no-op. Playwright doesn't do this by
// default, so replicate it: every spec importing `test` from here gets the
// same behavior, with the same one exemption the old cypress/support/e2e.js
// carved out.
//
// "ResizeObserver loop completed with undelivered notifications" is a
// notification that the observer callbacks didn't settle inside one frame,
// not a thrown exception — nothing is broken and the app carries on. It
// fires on the combobox dropdowns that reposition themselves inside a
// dialog, and which test it hits is down to timing.
const IGNORED = /ResizeObserver loop/;

export const test = base.extend({
	page: async ({ page }, use, testInfo) => {
		const errors: Error[] = [];
		page.on("pageerror", (error) => {
			if (IGNORED.test(error.message)) return;
			errors.push(error);
		});

		await use(page);

		// dialogLayering.ts keeps a bounded ring of its own restack() calls in
		// window.__dialogLayeringDebug specifically for the covered-overlay bug
		// in HANDOVER-lms-settings-dialog-bug.md, which only ever reproduces in
		// CI. Nothing surfaced it before now: attach it to the HTML report (does
		// what the trace can't — shows every restack(), not just the failing
		// click) and print it to the job log too, since the report artifact
		// needs a manual `gh run download` to inspect.
		if (testInfo.status !== testInfo.expectedStatus) {
			const debugLog = await page
				.evaluate(
					() =>
						(window as unknown as Record<string, unknown>).__dialogLayeringDebug
				)
				.catch(() => undefined);
			if (debugLog) {
				console.log(
					`[dialogLayeringDebug] ${testInfo.title}:`,
					JSON.stringify(debugLog)
				);
				await testInfo.attach("dialog-layering-debug", {
					body: JSON.stringify(debugLog, null, 2),
					contentType: "application/json",
				});
			}
		}

		expect(
			errors,
			`Uncaught exception(s) from the page: ${errors
				.map((e) => e.message)
				.join("; ")}`
		).toEqual([]);
	},
});

export { expect };
