import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lucideIcons } from 'frappe-ui/vite'

export default defineConfig({
	// `import { X } from 'frappe-ui'` resolves the entire barrel (src/index.ts,
	// ~30 component families incl. DatePicker/TextEditor/Charts/ListView), because
	// frappe-ui here is an installed npm package, not a symlinked working copy.
	// frappe-ui/vite's `barrelImports` plugin only rewrites named imports to deep,
	// single-component paths for a symlinked/working-copy install (`linkedOnly`
	// defaults true); tried forcing `linkedOnly: false` to narrow this and it broke
	// 16/18 tests in ravenRuleEditor.test.ts + GoogleMeetAccountForm.test.ts, because
	// it rewrites app code's `import { createResource } from 'frappe-ui'` etc. to a
	// deep path *before* those tests' `vi.mock('frappe-ui', ...)` gets a chance to
	// intercept it. The default (`linkedOnly: true`) is a no-op for this same reason
	// in reverse (skips rewriting), so it was left out entirely rather than added
	// for no effect. Net effect: mounting ANY unmocked frappe-ui export currently
	// evaluates the whole barrel's module graph, same as a real (non-linked) dev
	// server today, not a test-only gap. `lucideIcons` below exists because that
	// full-barrel load reaches `DatePicker` -> `PickerShell.vue`, which imports the
	// `~icons/lucide/chevron-down` virtual module (NOT Combobox's own chevron;
	// that's a plain `lucide-chevron-down` CSS class, no icon import involved).
	// Registering `lucideIcons` also turns on `unplugin-auto-import` /
	// `unplugin-vue-components`, which write to the tracked
	// `frontend/auto-imports.d.ts` / `frontend/components.d.ts` on every test run
	// (same scan frappeuiPlugin runs in prod, so currently a no-op diff, but note
	// it: `vitest run` now performs filesystem writes to version-controlled files).
	plugins: [vue(), ...lucideIcons()],
	test: {
		environment: 'jsdom',
		globals: true,
		include: ['src/tests/**/*.test.{ts,js}'],
		// Registers v-safe-html the way main.js does, so a component test does
		// not have to know which components use the directive.
		setupFiles: ['src/tests/setup.ts'],
		// Nothing here is slow on its own. Every one of these files passes in
		// well under a second when run alone. The default 5s is wall-clock
		// though, and a full run mounts 60-odd suites in parallel, so a handful
		// of mount-heavy tests lose the race on a loaded machine and fail with a
		// timeout rather than an assertion. Raising the ceiling costs nothing
		// when they pass and stops the suite reporting a red that is really the
		// scheduler.
		testTimeout: 20000,
		server: {
			// frappe-ui ships plain-ESM files with extensionless relative imports
			// (valid under Vite's resolver, invalid under Node's strict ESM loader).
			// Vitest externalizes node_modules to Node's loader by default; inlining
			// keeps frappe-ui on Vite's transform/resolve pipeline, matching dev/build.
			deps: { inline: ['frappe-ui'] },
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src'),
		},
		dedupe: ['vue', 'frappe-ui'],
	},
})
