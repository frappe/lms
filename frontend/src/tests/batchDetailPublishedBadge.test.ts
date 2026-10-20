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

const { inert } = vi.hoisted(() => ({
	inert: () => ({ default: { render: () => null } }),
}))
vi.mock('@/pages/Batches/components/AdminBatchDashboard.vue', inert)
vi.mock('@/pages/Batches/components/BatchDashboard.vue', inert)
vi.mock('@/pages/Batches/BatchOverview.vue', inert)
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
		template: `<div :data-published="published"><slot name="solo" /></div>`,
	},
}))

// @ts-expect-error a JS SFC has no generated types (TS7016)
import BatchDetail from '@/pages/Batches/BatchDetail.vue'

const mountAs = async (user: Record<string, unknown> | null) => {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/batches/:batchName',
				name: 'BatchDetail',
				component: BatchDetail,
				props: true,
			},
		],
	})
	await router.push('/batches/B1')
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: { $user: { data: user } },
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper.find('[data-published]').attributes('data-published')
}

describe("BatchDetail's Published badge", () => {
	beforeEach(() => {
		createResourceMock.mockReset()
		createResourceMock.mockReturnValue(batchResource)
		batchResource.data = { name: 'B1', title: 'B', published: 1 }
	})

	it('is hidden from a guest', async () => {
		expect(await mountAs(null)).toBe('false')
	})

	it('is hidden from a student', async () => {
		batchResource.data = { ...batchResource.data, is_student: 1 }
		expect(await mountAs({ name: 'student@example.com' })).toBe('false')
	})

	it('is shown to someone who manages the batch', async () => {
		batchResource.data = { ...batchResource.data, can_manage: 1 }
		expect(await mountAs({ name: 'instructor@example.com' })).toBe('true')
	})
})
