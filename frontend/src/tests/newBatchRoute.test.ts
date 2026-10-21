import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// Navigation imports each matched page SFC, so stub them; the route table
// from @/routes stays real.
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
// This imports `@/routes` rather than `@/router`, which pulls in the stores and
// the navigation guard's server calls; the route table has none of that.
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
