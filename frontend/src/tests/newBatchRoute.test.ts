import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// vue-router resolves a matched record's async `component()` as part of
// navigation itself (to extract in-component guards), before this test ever
// asks what the current route is. The real Batches/NewBatchForm/BatchDetail
// SFCs pull in frappe-ui, and frappe-ui's ESM build does not resolve under
// plain Node module resolution (no bundler) — the same failure that made
// `@/router` unimportable here. Stubbing the three page components keeps the
// navigation real while keeping their unrelated dependency chains out of it;
// the route TABLE under test is still the genuine one from `@/routes`.
// HeaderButton wraps frappe-ui's Button in a Tooltip below the mobile
// breakpoint, and the hand-written frappe-ui mock here has no Tooltip. Stub it
// down to the bare button so the fallthrough attrs the assertions use
// (data-testid, the click handler) still land where they did before.
vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs" />`,
	},
}))

vi.mock('@/pages/Batches/Batches.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/Forms/NewBatchForm.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/Batches/BatchDetail.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))

// The REAL route table, not a copy of it. A test that reimplements the routes
// only proves vue-router ranks static above dynamic — it would stay green
// while the route table said something else entirely.
//
// This imports `@/routes` rather than `@/router`: router.js imports frappe-ui
// at module scope for its navigation guard, and frappe-ui's ESM build fails
// to resolve an extensionless import in this environment, so importing
// `@/router` throws before a single test runs. The route table itself has no
// such dependency — every entry is a lazy `() => import(...)` — so it lives in
// its own module and router.js imports it from there too.
import { routes } from '@/routes'

describe('the new-batch route', () => {
	it('resolves /batches/new to the form, not to a batch named "new"', async () => {
		const router = createRouter({ history: createMemoryHistory(), routes })
		await router.push('/batches/new')
		expect(router.currentRoute.value.name).toBe('NewBatch')
	})

	it('still resolves an ordinary batch name to the detail page', async () => {
		const router = createRouter({ history: createMemoryHistory(), routes })
		await router.push('/batches/BATCH-0001')
		expect(router.currentRoute.value.name).toBe('BatchDetail')
		expect(router.currentRoute.value.params.batchName).toBe('BATCH-0001')
	})

	it('keeps the form nested under the list so the list stays mounted', async () => {
		const router = createRouter({ history: createMemoryHistory(), routes })
		await router.push('/batches/new')
		const names = router.currentRoute.value.matched.map((r) => r.name)
		expect(names).toEqual(['Batches', 'NewBatch'])
	})
})
