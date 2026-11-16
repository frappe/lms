import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

type Resource = {
	data: unknown
	loading: boolean
	reload: () => void
	onSuccess?: (data: unknown) => void
}
type Route = { name: string; fullPath: string; params: Record<string, string> }

// The mocks are hoisted above the imports, so the reactive state is created
// inside the factories, where `vue` can be imported, and shared through `state`.
const state = vi.hoisted(() => ({
	resource: null as unknown as Resource,
	route: null as unknown as Route,
	push: vi.fn(),
	capture: vi.fn(),
}))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	state.resource = reactive({ data: null, loading: false, reload: vi.fn() })
	return {
		Button: {
			props: ['label'],
			template: `<button @click="$emit('click')"><slot name="icon" />{{ label }}<slot /></button>`,
		},
		createResource: (options: { onSuccess?: (data: unknown) => void }) => {
			state.resource.onSuccess = options.onSuccess
			return state.resource
		},
		Tooltip: { template: `<div><slot /></div>` },
	}
})
vi.mock('vue-router', async () => {
	const { reactive } = await import('vue')
	state.route = reactive({ name: 'Courses', fullPath: '/courses', params: {} })
	return {
		useRoute: () => state.route,
		useRouter: () => ({ push: state.push }),
	}
})
vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: state.capture }),
}))

import ContinueCoursePanel from '@/components/ContinueCoursePanel.vue'
import { forgetContinuePanelClosed } from '@/utils/continuePanel'

const draft = (steps: boolean[]) => ({
	course: 'marketing-101',
	title: 'Marketing 101',
	last_edited: '2026-10-18 10:00:00',
	lesson: 'LESSON-1',
	steps: [
		{ name: 'chapter', done: steps[0] },
		{ name: 'lesson', done: steps[1] },
		{ name: 'publish', done: steps[2] },
	],
})

// What the server sends, through the resource's own callback.
const answer = (data: unknown) => {
	state.resource.data = data
	state.resource.onSuccess?.(data)
}

const mountPanel = (besideHelp = false, user = 'author@example.com') =>
	mount(ContinueCoursePanel, {
		props: { user, besideHelp },
		global: { mocks: { __: globalThis.__ } },
	})

beforeEach(() => {
	sessionStorage.clear()
	state.resource.data = null
	state.resource.loading = false
	state.route.name = 'Courses'
	state.route.fullPath = '/courses'
	state.route.params = {}
	state.push.mockClear()
	state.capture.mockClear()
	vi.mocked(state.resource.reload).mockClear()
})

describe('the continue-your-course panel', () => {
	it('renders nothing without a draft', () => {
		expect(mountPanel().find('aside').exists()).toBe(false)
	})

	it('lists every step, counts the done ones and makes only the open ones clickable', () => {
		state.resource.data = draft([true, false, false])
		const wrapper = mountPanel()
		expect(wrapper.text()).toContain('Marketing 101')
		expect(wrapper.text()).toContain('1 of 3 steps to publish')
		expect(wrapper.findAll('li').map((li) => li.text())).toEqual([
			'Add a chapter',
			'Add a lesson with content',
			'Publish the course',
		])
		expect(wrapper.findAll('li button').map((b) => b.text())).toEqual([
			'Add a lesson with content',
			'Publish the course',
		])
	})

	it('each open step leads where it is done', async () => {
		state.resource.data = draft([false, false, false])
		const wrapper = mountPanel()
		const steps = wrapper.findAll('li button')
		await steps[0].trigger('click')
		expect(state.push).toHaveBeenLastCalledWith({
			name: 'CourseDetail',
			params: { courseName: 'marketing-101' },
			hash: '#editor',
			query: {},
		})
		await steps[1].trigger('click')
		expect(state.push).toHaveBeenLastCalledWith({
			name: 'CourseDetail',
			params: { courseName: 'marketing-101' },
			hash: '#editor',
			query: { editLessonName: 'LESSON-1' },
		})
		await steps[2].trigger('click')
		expect(state.push).toHaveBeenLastCalledWith({
			name: 'CourseDetail',
			params: { courseName: 'marketing-101' },
			hash: '#settings',
		})
	})

	it('opens the editor on the lesson the author left', async () => {
		state.resource.data = draft([true, true, false])
		const wrapper = mountPanel()
		await wrapper.findAll('button').at(-1)!.trigger('click')
		expect(state.push).toHaveBeenCalledWith({
			name: 'CourseDetail',
			params: { courseName: 'marketing-101' },
			hash: '#editor',
			query: { editLessonName: 'LESSON-1' },
		})
	})

	it('closing hides it for the session, for that user only, until a sign-out', async () => {
		state.resource.data = draft([true, false, false])
		const wrapper = mountPanel()
		await wrapper.find('button[aria-label="Close"]').trigger('click')
		expect(wrapper.find('aside').exists()).toBe(false)
		// The event keeps the progress the panel showed.
		expect(state.capture).toHaveBeenCalledWith('continue_course_panel_closed', {
			course: 'marketing-101',
			steps_done: 1,
		})
		expect(mountPanel().find('aside').exists()).toBe(false)
		// A shared tab outlives a sign-out: the next person still gets theirs.
		expect(mountPanel(false, 'other@example.com').find('aside').exists()).toBe(
			true
		)
		// And a sign-out drops the flag, so the same person sees it again.
		forgetContinuePanelClosed()
		expect(mountPanel().find('aside').exists()).toBe(true)
	})

	it('stays hidden on the draft course itself and its form dialogs', async () => {
		state.resource.data = draft([false, false, false])
		const wrapper = mountPanel()
		expect(wrapper.find('aside').exists()).toBe(true)
		state.route.name = 'CourseDetail'
		state.route.params = { courseName: 'marketing-101' }
		await nextTick()
		expect(wrapper.find('aside').exists()).toBe(false)
		// The chapter form is a route of its own, rendered as a dialog over the
		// course page.
		state.route.name = 'ChapterForm'
		await nextTick()
		expect(wrapper.find('aside').exists()).toBe(false)
		state.route.name = 'CourseDetail'
		state.route.params = { courseName: 'other-course' }
		await nextTick()
		expect(wrapper.find('aside').exists()).toBe(true)
	})

	it('asks again after every navigation, and once more for one that lands mid-call', async () => {
		state.resource.data = draft([false, false, false])
		mountPanel()
		state.route.fullPath = '/courses/marketing-101'
		await nextTick()
		expect(state.resource.reload).toHaveBeenCalledTimes(1)

		state.resource.loading = true
		state.route.fullPath = '/courses'
		await nextTick()
		expect(state.resource.reload).toHaveBeenCalledTimes(1)
		state.resource.loading = false
		await nextTick()
		expect(state.resource.reload).toHaveBeenCalledTimes(2)
	})

	it('stops asking once the site has a published course', async () => {
		mountPanel()
		answer({ done: true })
		state.route.fullPath = '/courses/marketing-101'
		await nextTick()
		expect(state.resource.reload).not.toHaveBeenCalled()
	})

	it('reports being shown once per draft, and only when on screen', async () => {
		state.route.name = 'CourseDetail'
		state.route.params = { courseName: 'marketing-101' }
		state.resource.data = draft([true, false, false])
		const wrapper = mountPanel()
		expect(state.capture).not.toHaveBeenCalled()

		state.route.name = 'Courses'
		state.route.params = {}
		await nextTick()
		expect(state.capture).toHaveBeenCalledWith('continue_course_panel_shown', {
			course: 'marketing-101',
			steps_done: 1,
		})

		state.route.params = { courseName: 'marketing-101' }
		await nextTick()
		state.route.params = {}
		await nextTick()
		expect(wrapper.find('aside').exists()).toBe(true)
		expect(state.capture).toHaveBeenCalledTimes(1)
	})

	it('moves beside the help panel when that is open', () => {
		state.resource.data = draft([false, false, false])
		expect(mountPanel(true).find('aside').classes()).toContain(
			'end-[22.25rem]'
		)
		expect(mountPanel(false).find('aside').classes()).toContain('end-5')
	})
})
