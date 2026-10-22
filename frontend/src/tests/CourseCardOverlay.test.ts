import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'

const { passthrough, outline } = vi.hoisted(() => ({
	passthrough: { template: `<div><slot /></div>` },
	outline: { data: null as unknown, reload: () => {} },
}))

vi.mock('frappe-ui', () => ({
	Badge: passthrough,
	Button: { template: `<button><slot name="prefix" /><slot /></button>` },
	Tooltip: passthrough,
	call: vi.fn(),
	createResource: (opts: { url: string }) =>
		opts.url.endsWith('get_course_outline') ? outline : { submit: vi.fn() },
	toast: { success: vi.fn(), warning: vi.fn() },
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/CertificationLinks.vue', () => ({
	default: { render: () => null },
}))
vi.mock('@/components/VideoPreview.vue', () => ({
	default: { render: () => null },
}))

import CourseCardOverlay from '@/components/CourseCardOverlay.vue'

const lessons = (done: number, total: number) =>
	Array.from({ length: total }, (_, i) => ({ is_complete: i < done }))

const mountWith = (data: Record<string, unknown>, outlineData: unknown) => {
	outline.data = outlineData
	return mount(CourseCardOverlay, {
		props: {
			course: reactive({ data: { name: 'COURSE-1', ...data } }),
		} as never,
		global: {
			provide: { $user: { data: { name: 'learner@example.com' } } },
			mocks: { __: globalThis.__ },
		},
	})
}

// Regression: course page showed no progress to an enrolled learner (#3014, fixed in #3039).
describe('the learner progress in the course side card', () => {
	it('shows the bar, the lesson count and Continue once started', () => {
		const wrapper = mountWith(
			{ lessons: 14, membership: { progress: 85.714 } },
			[{ lessons: lessons(5, 6) }, { lessons: lessons(7, 8) }]
		)

		expect(
			wrapper.find('[role="progressbar"]').attributes('aria-valuenow')
		).toBe('86')
		expect(wrapper.text()).toContain('12 of 14 lessons completed')
		expect(wrapper.text()).toContain('Continue Learning')
		expect(wrapper.text()).not.toContain('Start Learning')
	})

	it('says Start Learning before the first lesson is done', () => {
		const wrapper = mountWith({ lessons: 14, membership: { progress: 0 } }, [
			{ lessons: lessons(0, 14) },
		])

		expect(wrapper.text()).toContain('0 of 14 lessons completed')
		expect(wrapper.text()).toContain('Start Learning')
		expect(wrapper.text()).not.toContain('Continue Learning')
	})

	// Regression: count came from stale stored % x current total (#3014, fixed in #3039).
	it('counts completed lessons, not the stored percentage', () => {
		const wrapper = mountWith({ lessons: 15, membership: { progress: 50 } }, [
			{ lessons: lessons(4, 15) },
		])

		expect(wrapper.text()).toContain('4 of 15 lessons completed')
	})
})
