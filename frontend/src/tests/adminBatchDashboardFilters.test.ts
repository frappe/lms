/**
 * The students list carries a frappe-ui `cache` key so BatchStudentForm can
 * reload it after inserting. That key makes the resource outlive the component,
 * and its `filters` ride along with it — but `searchFilter` is a plain
 * component-local ref that starts empty on every mount. So a second mount would
 * render the previous visit's search results underneath a blank search box.
 *
 * The fake resource below reproduces the part of frappe-ui that causes this:
 * createListResource returns the FIRST instance for a cache key and discards
 * the new options (frappe-ui/src/resources/listResource.js via
 * resources.js:9-21). A mock that handed back a fresh resource each time would
 * pass against the bug.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

interface FakeList {
	doctype: string
	filters: Record<string, unknown>
	data: unknown[]
	loading: boolean
	hasNextPage: boolean
	update: (o: { filters: Record<string, unknown> }) => void
	reload: () => void
	next: () => void
}

const h = vi.hoisted(() => ({
	listCache: new Map<string, any>(),
	reloads: [] as string[],
}))

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

vi.mock('frappe-ui', () => {
	const passthrough = (name: string) => ({
		name,
		props: ['modelValue'],
		emits: ['update:modelValue'],
		template: `<div />`,
	})
	return {
		createListResource: (options: any): FakeList => {
			const key = JSON.stringify(options.cache)
			if (options.cache && h.listCache.has(key)) return h.listCache.get(key)
			const res = reactive({
				doctype: options.doctype,
				filters: options.filters,
				data: [],
				loading: false,
				hasNextPage: false,
			}) as FakeList
			res.update = ({ filters }) => {
				res.filters = filters
			}
			res.reload = () => {
				h.reloads.push(JSON.stringify(res.filters))
			}
			res.next = () => {}
			if (options.cache) h.listCache.set(key, res)
			return res
		},
		createResource: (options: any) =>
			reactive({
				data: options.doctype === 'LMS Batch Enrollment' ? 4 : null,
				loading: false,
				reload: () => {},
				update: () => {},
				submit: () => {},
			}),
		FormControl: passthrough('FormControl'),
		Avatar: passthrough('Avatar'),
		Button: passthrough('Button'),
	}
})

vi.mock('@/utils', () => ({ formatAmount: (v: unknown) => String(v) }))

// Inlined rather than built by a helper: vi.mock factories are hoisted above
// every top-level binding in this file.
vi.mock('@/pages/Batches/components/BatchFeedback.vue', () => ({
	default: { name: 'BatchFeedback', template: '<div />' },
}))
vi.mock('@/pages/Batches/components/BatchStudentProgress.vue', () => ({
	default: { name: 'BatchStudentProgress', template: '<div />' },
}))
vi.mock('@/components/NumberChartGraph.vue', () => ({
	default: { name: 'NumberChartGraph', template: '<div />' },
}))
vi.mock('@/components/ResponsiveListView.vue', () => ({
	default: { name: 'ResponsiveListView', template: '<div />' },
}))
vi.mock('@/components/Layouts/EmptyStateLayout.vue', () => ({
	default: { name: 'EmptyStateLayout', template: '<div />' },
}))

import AdminBatchDashboard from '@/pages/Batches/components/AdminBatchDashboard.vue'

const BATCH = { data: { name: 'B1', title: 'Batch One', seat_count: 10 } }

const mountDashboard = () =>
	mount(AdminBatchDashboard, {
		props: { batch: BATCH },
		global: {
			provide: { $dayjs: (v: unknown) => ({ format: () => String(v) }) },
			mocks: { __: (s: string) => s },
			stubs: { RouterLink: true },
		},
	})

const cachedList = (): FakeList =>
	h.listCache.get(JSON.stringify(['batchStudents', 'B1']))

describe('AdminBatchDashboard students filters', () => {
	beforeEach(() => {
		h.listCache.clear()
		h.reloads.length = 0
	})

	it('shares one cached resource across mounts', async () => {
		const first = mountDashboard()
		await flushPromises()
		const resource = cachedList()
		first.unmount()

		const second = mountDashboard()
		await flushPromises()

		expect(cachedList()).toBe(resource)
		second.unmount()
	})

	it('does not refetch on a first mount, whose filters already agree', async () => {
		const wrapper = mountDashboard()
		await flushPromises()

		expect(h.reloads).toEqual([])
		wrapper.unmount()
	})

	// The regression: the search the previous visit left behind.
	it('clears a stale search filter left by an earlier mount', async () => {
		const first = mountDashboard()
		await flushPromises()
		cachedList().update({
			filters: { batch: 'B1', member_name: ['like', '%jane%'] },
		})
		first.unmount()

		const second = mountDashboard()
		await flushPromises()

		expect(cachedList().filters).toEqual({ batch: 'B1' })
		expect(h.reloads).toContain(JSON.stringify({ batch: 'B1' }))
		second.unmount()
	})
})
