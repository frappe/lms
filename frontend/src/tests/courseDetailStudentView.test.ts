import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

const { passthrough, selection } = vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		passthrough: { template: `<div><slot /></div>` },
		selection: { value: null as Record<string, unknown> | null },
	}
})

vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))

// frappe-ui's Button renders a RouterLink for `route`, which resolves it during
// render. Doing the same here is what makes an unresolvable route throw.
vi.mock('frappe-ui', async () => {
	const { RouterLink } = await import('vue-router')
	const { defineComponent, h } = await import('vue')
	return {
		createResource: () => ({ data: null, loading: false, reload: vi.fn() }),
		usePageMeta: vi.fn(),
		toast: { success: vi.fn(), error: vi.fn() },
		Badge: passthrough,
		Button: defineComponent({
			props: ['route'],
			setup(props, { slots }) {
				return () =>
					props.route
						? h(RouterLink, { to: props.route }, slots)
						: h('button', slots.default?.())
			},
		}),
		Dropdown: passthrough,
		Tooltip: passthrough,
	}
})
vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))
vi.mock('@framework/ui/components/Onboarding/index', () => ({
	useOnboarding: () => ({ updateOnboardingStep: vi.fn() }),
}))

const { stub } = vi.hoisted(() => ({
	stub: () => ({ default: { render: () => null } }),
}))
vi.mock('@/components/Layouts/pages/TabbedDetailPage.vue', () => ({
	default: {
		setup(_: unknown, { slots }: { slots: Record<string, Function> }) {
			return () => [
				slots.actions?.({ tab: { key: 'editor' } }),
				slots['tab-body-editor']?.(),
			]
		},
	},
}))
vi.mock('@/pages/Courses/CourseEditor.vue', () => ({
	default: {
		emits: ['update:selected'],
		setup(
			_: unknown,
			{ emit }: { emit: (event: string, value: unknown) => void }
		) {
			emit('update:selected', selection.value)
			return () => null
		},
	},
}))
vi.mock('@/pages/Courses/CourseOverview.vue', stub)
vi.mock('@/pages/Courses/CourseDashboard.vue', stub)
vi.mock('@/pages/Courses/CourseForm.vue', stub)
vi.mock('@/components/SkeletonLoader.vue', stub)
vi.mock('@/components/LessonHelp.vue', stub)
vi.mock('@/components/ShortcutTooltip.vue', stub)
vi.mock('@/components/HeaderButton.vue', stub)

import CourseDetail from '@/pages/Courses/CourseDetail.vue'

const mountWith = async (selected: Record<string, unknown>) => {
	selection.value = selected
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/courses/:courseName',
				name: 'CourseDetail',
				component: CourseDetail,
			},
			{
				path: '/courses/:courseName/learn/:chapterNumber-:lessonNumber',
				name: 'Lesson',
				component: defineComponent({ render: () => h('div') }),
			},
		],
	})
	await router.push('/courses/COURSE-1')
	const wrapper = mount(CourseDetail, {
		props: { courseName: 'COURSE-1' },
		global: {
			plugins: [router],
			provide: { $user: { data: { name: 'mod@example.com' } } },
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

describe('the Student View link', () => {
	it('links to the open lesson once it has a position', async () => {
		const wrapper = await mountWith({
			chapterNumber: '1',
			lessonNumber: '2',
			number: '1-2',
			name: 'L-1',
		})
		const link = wrapper.find('a[href*="/learn/"]')
		expect(link.attributes('href')).toBe(
			'/courses/COURSE-1/learn/1-2?studentView=1'
		)
	})

	it('is hidden for a lesson just created, before the outline places it', async () => {
		const wrapper = await mountWith({
			chapterNumber: '',
			lessonNumber: '',
			number: '',
			name: 'L-NEW',
		})
		expect(wrapper.find('a[href*="/learn/"]').exists()).toBe(false)
	})
})
