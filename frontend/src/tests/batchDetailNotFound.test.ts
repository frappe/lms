import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

const { batchResource, createResourceMock } = vi.hoisted(() => ({
	batchResource: {
		data: null as Record<string, unknown> | null,
		loading: false,
		fetched: true,
		error: null,
		reload: vi.fn(),
		submit: vi.fn(),
	},
	createResourceMock: vi.fn(),
}))

vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	usePageMeta: () => {},
	toast: { success: vi.fn(), error: vi.fn() },
	Badge: { template: `<span><slot /></span>` },
	Tooltip: { template: `<div><slot /></div>` },
	Button: { template: `<button><slot /></button>` },
	Dropdown: { template: `<div />` },
}))

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: { favicon: '' } }),
}))

const { inert, marker } = vi.hoisted(() => ({
	inert: () => ({ default: { render: () => null } }),
	marker: (text: string) => () => ({ default: { template: `<p>${text}</p>` } }),
}))
vi.mock('@/pages/Batches/components/AdminBatchDashboard.vue', inert)
vi.mock('@/pages/Batches/components/BatchDashboard.vue', inert)
vi.mock('@/pages/Batches/BatchOverview.vue', marker('OVERVIEW'))
vi.mock('@/pages/NotFound.vue', marker('NOT FOUND'))
vi.mock('@/pages/Batches/components/LiveClass.vue', inert)
vi.mock('@/pages/Batches/components/Announcements.vue', inert)
vi.mock('@/pages/Batches/BatchForm.vue', inert)
vi.mock('@/components/Discussions.vue', inert)
vi.mock('@/components/SkeletonLoader.vue', inert)
vi.mock('@/components/ShortcutTooltip.vue', inert)
vi.mock('@/components/HeaderButton.vue', inert)
vi.mock('@/components/Layouts/TabbedDetailPage.vue', () => ({
	default: {
		props: ['tabs', 'breadcrumbs', 'published', 'loading', 'doc', 'docProp'],
		template: `<div><slot name="solo" /></div>`,
	},
}))

// @ts-expect-error a JS SFC has no generated types (TS7016)
import BatchDetail from '@/pages/Batches/BatchDetail.vue'

const mountAt = async (path: string) => {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/batches', name: 'Batches', component: { render: () => null } },
			{
				path: '/batches/:batchName',
				name: 'BatchDetail',
				component: BatchDetail,
				props: true,
			},
		],
	})
	await router.push(path)
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: { $user: { data: null } },
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

describe('BatchDetail for a batch the viewer cannot see', () => {
	beforeEach(() => {
		createResourceMock.mockReset()
		createResourceMock.mockReturnValue(batchResource)
	})

	// get_batch_details answers an unpublished batch with `{}`, which is truthy,
	// so the page used to render the overview against an empty object.
	it('shows not found when the batch comes back empty', async () => {
		batchResource.data = {}
		const wrapper = await mountAt('/batches/hidden')
		expect(wrapper.text()).toContain('NOT FOUND')
		expect(wrapper.text()).not.toContain('OVERVIEW')
	})

	it('renders the batch when it comes back', async () => {
		batchResource.data = { name: 'open', title: 'Open' }
		const wrapper = await mountAt('/batches/open')
		expect(wrapper.text()).toContain('OVERVIEW')
		expect(wrapper.text()).not.toContain('NOT FOUND')
	})
})
