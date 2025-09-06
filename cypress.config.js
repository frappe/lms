import { defineConfig } from "cypress";

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
	},
});
