import { defineConfig } from "cypress";
import cypressSplit from "cypress-split";

export default defineConfig({
	projectId: "vandxn",
	adminPassword: "admin",
	testUser: "frappe@example.com",
	defaultCommandTimeout: 20000,
	pageLoadTimeout: 15000,
	video: true,
	videoUploadOnPasses: false,
	retries: {
		runMode: 2,
		openMode: 0,
	},
	e2e: {
		baseUrl: "http://pertest:8000",
		setupNodeEvents(on, config) {
			// Splitting tests only works when Cypress Cloud is not orchestrating parallel runs.
			if (process.env.CYPRESS_CLOUD_PARALLEL !== "1") {
				cypressSplit(on, config);
			}
			return config;
		},
	},
});
