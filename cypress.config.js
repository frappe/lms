const { defineConfig } = require("cypress");

module.exports = defineConfig({
	projectId: "",
	adminPassword: "admin",
	testUser: "ash@ipp.com",
	retries: {
		runMode: 2,
		openMode: 0,
	},
	e2e: {},
});
