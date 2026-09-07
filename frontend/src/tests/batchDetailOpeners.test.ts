import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type Router,
} from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

const { batchResource, createResourceMock } = vi.hoisted(() => ({
	batchResource: {
		data: {
			name: 'B1',
			title: 'Batch One',
			certification: 1,
			students: ['a@example.com'],
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
		props: ['options', 'placement', 'side'],
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

// Drives the #actions slot with a chosen tab, which is the only way to reach
// the header openers without standing up the whole tab shell.
vi.mock('@/components/Layouts/TabbedDetailPage.vue', () => ({
	default: {
		props: ['tabs', 'breadcrumbs', 'published', 'loading', 'doc', 'docProp'],
		template: `<div><slot name="actions" :tab="{ key: 'announcements' }" :instance="null" /></div>`,
	},
}))

// @ts-expect-error a JS SFC has no generated types (TS7016) — the same gap
// every test importing a non-`lang="ts"` component in this suite hits.
import BatchDetail from '@/pages/Batches/BatchDetail.vue'

const Form = defineComponent({ render: () => h('div', 'FORM') })

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/batches/:batchName',
				name: 'BatchDetail',
				component: BatchDetail,
				props: true,
				children: [
					{
						path: 'certificates',
						name: 'BulkCertificates',
						component: Form,
						props: true,
					},
					{
						path: 'announcement/new',
						name: 'NewAnnouncement',
						component: Form,
						props: true,
					},
				],
			},
		],
	})

const mountPage = async (router: Router) => {
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: {
				$user: { data: { name: 'mod@example.com', is_moderator: true } },
			},
			stubs: { teleport: true },
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

describe("BatchDetail's form openers", () => {
	beforeEach(() => {
		createResourceMock.mockReset()
		createResourceMock.mockReturnValue(batchResource)
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	// Both openers read `route.hash`. When BatchDetail moved onto
	// TabbedDetailPage it lost its `useRoute()` — and only the certificates
	// opener sat in a merge conflict, so the announcement one would have merged
	// clean and thrown a ReferenceError on the first click, with nothing to
	// catch it. These two tests call each opener for real.
	it('opens the announcement form carrying the current tab hash', async () => {
		const router = makeRouter()
		await router.push('/batches/B1#announcements')
		const wrapper = await mountPage(router)

		await wrapper.find('[data-label="Make Announcement"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.fullPath).toBe(
			'/batches/B1/announcement/new#announcements'
		)
	})

	it('opens the certificates form carrying the current tab hash', async () => {
		const router = makeRouter()
		await router.push('/batches/B1#announcements')
		const wrapper = await mountPage(router)

		const options = wrapper
			.findComponent({ name: 'Dropdown' })
			.props('options') as { label: string; onClick: () => void }[]
		const generate = options.find(
			(option) => option.label === 'Generate Certificates'
		)
		expect(generate).toBeDefined()
		generate?.onClick()
		await flushPromises()
		expect(router.currentRoute.value.fullPath).toBe(
			'/batches/B1/certificates#announcements'
		)
	})

	it('renders the child form route through its own outlet', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/announcement/new#announcements')
		const wrapper = await mountPage(router)
		expect(wrapper.text()).toContain('FORM')
	})
})
