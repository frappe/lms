import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h, reactive } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// Onboarding's Publish the course step opens the course with ?publish=1, and
// the page focuses its own Publish button once the settings header shows it.
const { passthrough, course } = vi.hoisted(() => ({
	passthrough: { template: `<div><slot /></div>` },
	course: { data: null as { name: string; published: number } | null },
}))

vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))
vi.mock('frappe-ui', () => ({
	createResource: (options: { url?: string }) =>
		options.url === 'lms.lms.utils.get_course_details'
			? course
			: { loading: false, submit: vi.fn(), reload: vi.fn() },
	usePageMeta: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
	Badge: passthrough,
	Button: {
		inheritAttrs: false,
		template: `<button type="button" data-testid="publish" v-bind="$attrs"><slot /></button>`,
	},
	Dropdown: passthrough,
	Tooltip: passthrough,
}))
vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))
vi.mock('@/onboarding/useLearningOnboarding', () => ({
	useLearningOnboarding: () => ({ completeStep: vi.fn() }),
}))

// The page shell renders only the settings tab's header actions, the slot the
// Publish button lives in, and only once the course has loaded.
vi.mock('@/components/Layouts/pages/TabbedDetailPage.vue', async () => {
	const { defineComponent: define, h: render } = await import('vue')
	return {
		default: define({
			props: ['loading'],
			setup(props, { slots, expose }) {
				expose({
					instanceFor: () => ({ isDirty: false, courseMenu: [] }),
				})
				return () =>
					render(
						'div',
						props.loading ? [] : slots.actions?.({ tab: { key: 'settings' } })
					)
			},
		}),
	}
})
const { stub } = vi.hoisted(() => ({
	stub: () => ({ default: { render: () => null } }),
}))
vi.mock('@/pages/Courses/CourseOverview.vue', stub)
vi.mock('@/pages/Courses/CourseDashboard.vue', stub)
vi.mock('@/pages/Courses/CourseEditor.vue', stub)
vi.mock('@/pages/Courses/CourseForm.vue', stub)
vi.mock('@/components/SkeletonLoader.vue', stub)
vi.mock('@/components/LessonHelp.vue', stub)
vi.mock('@/components/ShortcutTooltip.vue', stub)
vi.mock('@/components/HeaderButton.vue', stub)

import CourseDetail from '@/pages/Courses/CourseDetail.vue'

let wrapper: VueWrapper | null = null

afterEach(() => {
	wrapper?.unmount()
	wrapper = null
	course.data = null
})

async function openCourse(query: Record<string, string>) {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/courses/:courseName',
				name: 'CourseDetail',
				component: defineComponent({ render: () => h('div') }),
				props: true,
			},
		],
	})
	await router.push({
		name: 'CourseDetail',
		params: { courseName: 'COURSE-1' },
		query,
		hash: '#settings',
	})
	const replace = vi.spyOn(router, 'replace')
	wrapper = mount(CourseDetail, {
		props: { courseName: 'COURSE-1' },
		attachTo: document.body,
		global: {
			plugins: [router],
			provide: {
				$user: reactive({ data: { name: 'mod', is_moderator: true } }),
			},
			mocks: { __: (text: string) => text },
			stubs: { RouterView: true },
		},
	})
	await flushPromises()
	return { replace }
}

const publishButton = () => wrapper!.find('[data-testid="publish"]')

describe('CourseDetail: publish from onboarding', () => {
	// Guards: onboarding's Publish the course step not focusing Publish, or
	// pressing it. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there for the ?publish=1 intent.
	it('focuses Publish once the course has loaded, without pressing it', async () => {
		await openCourse({ publish: '1' })
		expect(publishButton().exists()).toBe(false)

		course.data = { name: 'COURSE-1', published: 0 }
		wrapper!.vm.$forceUpdate()
		await flushPromises()

		expect(document.activeElement).toBe(publishButton().element)
		expect(publishButton().text()).toBe('Publish')
	})

	// Guards: ?publish=1 staying in the URL and stealing focus on a later visit.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there.
	it('drops the query once read, so a later visit leaves focus alone', async () => {
		const { replace } = await openCourse({ publish: '1', editLesson: '1-1' })
		expect(replace).toHaveBeenCalledWith({
			query: { editLesson: '1-1' },
			hash: '#settings',
		})
	})

	// Guards: plain course visits moving focus to Publish. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there.
	it('leaves focus alone without the intent', async () => {
		course.data = { name: 'COURSE-1', published: 0 }
		const { replace } = await openCourse({})
		expect(publishButton().exists()).toBe(true)
		expect(document.activeElement).toBe(document.body)
		expect(replace).not.toHaveBeenCalled()
	})
})
