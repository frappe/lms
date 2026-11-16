// BatchDetail offers its Discussions tab only to roles that can read both
// discussion doctypes, on top of being enrolled.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

const { batchResource, createResourceMock } = vi.hoisted(() => ({
	batchResource: {
		data: {
			name: 'B1',
			title: 'Batch One',
			certification: 1,
			is_student: true,
		} as Record<string, unknown>,
		loading: false,
		fetched: true,
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
	Tooltip: { inheritAttrs: false, template: `<div><slot /></div>` },
	Button: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs"><slot name="icon" /><slot /></button>`,
	},
	// The certificates opener lives inside a Dropdown option object rather than
	// on a DOM node, so the stub has to expose `options` for the test to invoke.
	Dropdown: {
		name: 'Dropdown',
		props: ['options', 'side'],
		template: `<div class="dropdown"><slot :open="false" /></div>`,
	},
}))

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: { favicon: '' } }),
}))

// Every tab component and header widget is imported at module scope and drags
// in its own dependency tree; none of them is under test here.
// vi.hoisted: a vi.mock factory is hoisted above every top-level const.
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
vi.mock('@/components/ShortcutTooltip.vue', () => ({
	default: { template: `<div><slot /></div>` },
}))
vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		inheritAttrs: false,
		props: ['label', 'icon', 'variant', 'disabled'],
		template: `<button v-bind="$attrs" :data-label="label">{{ label }}</button>`,
	},
}))

const captured = vi.hoisted(() => ({ tabs: [] as any[] }))

vi.mock('@/components/Layouts/pages/TabbedDetailPage.vue', async () => {
	const { defineComponent, watchEffect } = await import('vue')
	return {
		default: defineComponent({
			props: ['tabs', 'breadcrumbs', 'published', 'loading', 'doc', 'docProp'],
			setup(props: { tabs: any[] }) {
				watchEffect(() => {
					captured.tabs = props.tabs
				})
				return () => null
			},
		}),
	}
})

// @ts-expect-error a JS SFC has no generated types (TS7016), like every
// non-`lang="ts"` component this suite imports.
import BatchDetail from '@/pages/Batches/BatchDetail.vue'

const ALL = { read: 1, write: 1, create: 1, delete: 1 }
const NONE = { read: 0, write: 0, create: 0, delete: 0 }

const mountAs = async (permissions: Record<string, typeof ALL>) => {
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
	router.push('/batches/B1')
	await router.isReady()
	mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: {
				$user: { data: { name: 'a@example.com', permissions } },
			},
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
}

const discussionsTab = () =>
	captured.tabs.find((tab: { key: string }) => tab.key === 'discussions')

describe("BatchDetail's Discussions tab (#2538)", () => {
	beforeEach(() => {
		createResourceMock.mockReset()
		createResourceMock.mockReturnValue(batchResource)
		captured.tabs = []
	})

	it('shows for an enrolled student holding discussion read', async () => {
		await mountAs({ 'Discussion Topic': ALL, 'Discussion Reply': ALL })
		expect(discussionsTab()?.when).toBe(true)
	})

	it('hides once the role loses read on Discussion Reply', async () => {
		await mountAs({ 'Discussion Topic': ALL, 'Discussion Reply': NONE })
		expect(discussionsTab()?.when).toBe(false)
	})
})
