import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// The one thing this file exists for is easy to delete by accident: CourseDetail
// was rewritten wholesale onto TabbedDetailPage while this branch was in flight,
// and re-applying the branch on top of that rewrite is a hand edit that raises
// no conflict marker if it is skipped. Without the outlet the chapter route
// resolves and renders nothing at all.
const { passthrough } = vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return { passthrough: { template: `<div><slot /></div>` } }
})

vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))

type ResourceOptions = { url?: string; onSuccess?: () => void }

const { createResourceMock } = vi.hoisted(() => ({
	createResourceMock: vi.fn((_options?: ResourceOptions) => ({
		data: null,
		loading: false,
		reload: vi.fn(),
	})),
}))
vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	usePageMeta: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
	Badge: passthrough,
	Button: passthrough,
	Dropdown: passthrough,
	Tooltip: passthrough,
}))

// Mocks the specific `@framework/ui` submodules this file imports from — the
// bare package root's barrel also `export *`s components (GeolocationField
// among them) that import `leaflet`/`leaflet-draw` assets not installed here.
vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))
const { completeStepMock } = vi.hoisted(() => ({ completeStepMock: vi.fn() }))
vi.mock('@/onboarding/useLearningOnboarding', () => ({
	useLearningOnboarding: () => ({ completeStep: completeStepMock }),
}))

// `shallow` stubs these at RENDER time, but their modules are still imported at
// setup time, and several of them (the editor, the settings form) drag in the
// whole authoring stack. Stub the modules too, so this file stays a cheap,
// stable assertion about one line of template.
const { stub } = vi.hoisted(() => ({
	stub: () => ({ default: { render: () => null } }),
}))
vi.mock('@/components/Layouts/pages/TabbedDetailPage.vue', stub)
vi.mock('@/pages/Courses/CourseOverview.vue', stub)
vi.mock('@/pages/Courses/CourseDashboard.vue', stub)
vi.mock('@/pages/Courses/CourseEditor.vue', stub)
vi.mock('@/pages/Courses/CourseForm.vue', stub)
vi.mock('@/components/SkeletonLoader.vue', stub)
vi.mock('@/components/LessonHelp.vue', stub)
vi.mock('@/components/ShortcutTooltip.vue', stub)

import CourseDetail from '@/pages/Courses/CourseDetail.vue'

describe('the course page as a form parent', () => {
	it('renders a router outlet for its child form routes', async () => {
		const Child = defineComponent({ render: () => h('div', 'CHILD') })
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{
					path: '/courses/:courseName',
					name: 'CourseDetail',
					component: CourseDetail,
					props: true,
					children: [
						{ path: 'chapter/:chapterName', name: 'Child', component: Child },
					],
				},
			],
		})
		await router.push('/courses/COURSE-1/chapter/new')

		// shallow stubs every child component, including TabbedDetailPage and all
		// four tab bodies — but a stubbed RouterView is still findable, and it is
		// the only thing under test.
		const wrapper = mount(CourseDetail, {
			props: { courseName: 'COURSE-1' },
			shallow: true,
			global: {
				plugins: [router],
				provide: { $user: { data: { name: 'mod@example.com' } } },
				mocks: { __: (text: string) => text },
			},
		})
		await flushPromises()

		expect(wrapper.findComponent(RouterView).exists()).toBe(true)
	})
})

describe('the course publish toggle', () => {
	// Guards: publishing a course not ticking Publish the course. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to
	// cover the tick.
	it('completes the publish step when it publishes the course', async () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{
					path: '/courses/:courseName',
					name: 'CourseDetail',
					component: CourseDetail,
					props: true,
				},
			],
		})
		await router.push('/courses/COURSE-1')
		mount(CourseDetail, {
			props: { courseName: 'COURSE-1' },
			shallow: true,
			global: {
				plugins: [router],
				provide: { $user: { data: { name: 'mod@example.com' } } },
				mocks: { __: (text: string) => text },
			},
		})
		await flushPromises()

		const call = createResourceMock.mock.calls.find(
			([options]) => options?.url === 'frappe.client.set_value'
		)
		call?.[0]?.onSuccess?.()
		expect(completeStepMock).toHaveBeenCalledWith('publish_course')
	})
})
