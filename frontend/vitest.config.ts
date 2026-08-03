import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export default defineConfig({
	plugins: [vue()],
	test: {
		environment: 'jsdom',
		globals: true,
		include: ['src/tests/**/*.test.{ts,js}'],
		// Nothing here is slow on its own — every one of these files passes in
		// well under a second when run alone. The default 5s is wall-clock
		// though, and a full run mounts 60-odd suites in parallel, so a handful
		// of mount-heavy tests lose the race on a loaded machine and fail with a
		// timeout rather than an assertion. Raising the ceiling costs nothing
		// when they pass and stops the suite reporting a red that is really the
		// scheduler.
		testTimeout: 20000,
	},
	resolve: {
		alias: {
			'@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src'),
		},
		dedupe: ['vue', 'frappe-ui'],
	},
})
