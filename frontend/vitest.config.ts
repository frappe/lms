import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lucideIconsPlugin } from 'frappe-ui/vite'
import Components from 'unplugin-vue-components/vite'
import IconsResolver from 'unplugin-icons/resolver'

// autoprefixer's browserslist nags, once per run, that caniuse-lite is old.
// That is a dependency-freshness notice for whoever bumps packages, and the
// test output is not where anyone acts on it.
process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true'

// On a bench, @framework/ui links to apps/frappe/ui, whose own node_modules
// hold a dompurify with sourcemaps into that tree. Under preserveSymlinks vite
// reads those sources as outside the package and warns for each one. CI checks
// out ui without node_modules, so the warning describes the bench, not the code.
const quietLinkedSourcemaps: Plugin = {
	name: 'quiet-linked-sourcemaps',
	configResolved({ logger }) {
		const warnOnce = logger.warnOnce
		logger.warnOnce = (message, options) => {
			if (!message.includes('points to a source file outside its package')) {
				warnOnce(message, options)
			}
		}
	},
}

export default defineConfig({
	// `import { X } from 'frappe-ui'` resolves the entire barrel (src/index.ts,
	// incl. DatePicker/Dialog/Select), because frappe-ui here is an installed
	// npm package, not a symlinked working copy.
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
	// server today, not a test-only gap.
	//
	// The icon plugins are what frappe-ui/vite's `lucideIcons()` returns, minus
	// two things a test run must not do: write `components.d.ts` and
	// `auto-imports.d.ts` (both tracked), and register the auto-import plugin,
	// which LMS gives nothing to import. `<LucideX>` tags and @framework/ui's
	// `~icons/lucide/*` imports still resolve as in the app build.
	plugins: [
		quietLinkedSourcemaps,
		vue(),
		Components({
			resolvers: [
				IconsResolver({ prefix: false, enabledCollections: ['lucide'] }),
			],
			dts: false,
		}),
		lucideIconsPlugin(),
	],
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
			// tiptap and ProseMirror are inlined so `resolve.dedupe` below reaches
			// them: @tiptap/pm nests a second prosemirror-model, and a node from one
			// copy fails the other's instanceof checks.
			deps: {
				inline: ['frappe-ui', '@framework/ui', /@tiptap\//, /prosemirror-/],
			},
		},
	},
	resolve: {
		// Resolve the linked `@framework/ui` through its symlink rather than its real
		// path. It is `link:../../frappe/ui`, and its own source imports bare deps of
		// its own: `vuedraggable` in ConditionGroup.vue, plus reka-ui, dompurify and
		// frappe-ui. Resolution walks up from the *importer*, so following the link to
		// `apps/frappe/ui/src/...` looks for them under `apps/frappe` — which on a bench
		// has its own node_modules and in CI is a sparse checkout of `ui` alone. Keeping
		// the symlinked path walks up through `apps/lms/frontend/node_modules` instead,
		// where LMS already declares every one of them.
		//
		// So it fails only in CI, which is why it was invisible here: locally
		// `apps/frappe/node_modules/vuedraggable` satisfies the lookup. Both the vitest
		// run and the SPA build hit it, as "Failed to resolve import vuedraggable from
		// ...ConditionGroup.vue". Reproduce it by pointing the link at a copy of
		// apps/frappe/ui that has no node_modules beside it.
		preserveSymlinks: true,
		alias: {
			'@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src'),
		},
		// Match vite.config.js so tests load one ProseMirror and CodeMirror/Lezer
		// like the build.
		dedupe: [
			'prosemirror-model',
			'prosemirror-state',
			'prosemirror-view',
			'prosemirror-transform',
			'@codemirror/language',
			'@codemirror/state',
			'@codemirror/view',
			'@lezer/common',
			'@lezer/lr',
			'@lezer/highlight',
			'vue',
			'frappe-ui',
		],
	},
})
