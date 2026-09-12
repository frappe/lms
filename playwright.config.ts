import { defineConfig, devices } from "@playwright/test";
import { baseURL, authFile } from "./e2e/config";

export default defineConfig({
	testDir: "./e2e",
	// Not fullyParallel: every spec file's tests build on state the previous
	// test in the same file created (a course, an evaluator, a batch) — only
	// files are independent. The default already runs separate files in
	// parallel across workers; fullyParallel additionally splits a single
	// file's own tests across workers, racing them out of order.
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
	use: {
		baseURL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "setup",
			testMatch: /global\.setup\.ts/,
		},
		{
			name: "e2e",
			use: {
				...devices["Desktop Chrome"],
				storageState: authFile,
			},
			dependencies: ["setup"],
		},
	],
});
