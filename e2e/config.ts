// CYPRESS_BASE_URL is kept as a fallback purely so nothing else in the bench
// (helper scripts, docs) needs to change name at the same time as the test
// framework does.
export const baseURL =
	process.env.PLAYWRIGHT_BASE_URL ||
	process.env.CYPRESS_BASE_URL ||
	"http://lms.test:8000";

export const authFile = "playwright/.auth/admin.json";
