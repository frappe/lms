import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('frappe-ui', () => ({
	Button: {
		name: 'Button',
		props: ['route', 'disabled'],
		emits: ['click'],
		template: `<button :disabled="disabled" :data-route="route ? JSON.stringify(route) : undefined" @click="$emit('click')"><slot name="prefix" /><slot /><slot name="suffix" /></button>`,
	},
	Tooltip: {
		name: 'Tooltip',
		props: ['text'],
		template: `<span data-tooltip :data-text="text"><slot /></span>`,
	},
}))

const __ = (message: string) => message
vi.stubGlobal('__', __)

import LessonNavButtons from '@/components/LessonNavButtons.vue'

const mountNav = (props: Record<string, unknown>) =>
	mount(LessonNavButtons, {
		props: { courseName: 'COURSE-1', hasPrev: true, hasNext: true, ...props },
		global: { mocks: { __ } },
	})

const labels = (wrapper: ReturnType<typeof mountNav>) =>
	wrapper.findAll('button').map((button) => button.text())

const backRoutes = (wrapper: ReturnType<typeof mountNav>) =>
	wrapper
		.findAll('[data-testid="back-to-course"]')
		.map((button) => JSON.parse(button.attributes('data-route')!))

describe('LessonNavButtons', () => {
	it('shows Previous and Next between two lessons', async () => {
		const wrapper = mountNav({})
		expect(labels(wrapper)).toEqual(['Previous', 'Next'])

		await wrapper.findAll('button')[1].trigger('click')
		expect(wrapper.emitted('switch')).toEqual([['next']])
	})

	it('puts Back to course in the Previous slot on the first lesson', () => {
		const wrapper = mountNav({ hasPrev: false })

		expect(labels(wrapper)).toEqual(['Back to course', 'Next'])
		expect(backRoutes(wrapper)).toEqual([
			{ name: 'CourseDetail', params: { courseName: 'COURSE-1' } },
		])
	})

	it('puts Back to course in the Next slot on the last lesson', () => {
		const wrapper = mountNav({ hasNext: false })

		expect(labels(wrapper)).toEqual(['Previous', 'Back to course'])
	})

	it('shows a single Back to course on a one-lesson course', () => {
		const wrapper = mountNav({ hasPrev: false, hasNext: false })

		expect(labels(wrapper)).toEqual(['Back to course'])
	})

	it('keeps the student view query on Back to course', () => {
		const wrapper = mountNav({
			hasPrev: false,
			courseQuery: { studentView: 'not-enrolled' },
		})

		expect(backRoutes(wrapper)[0].query).toEqual({
			studentView: 'not-enrolled',
		})
	})

	it('disables a locked Next behind a focusable tooltip trigger', async () => {
		const wrapper = mountNav({ nextLocked: true })
		const trigger = wrapper.get('[data-testid="next-locked"]')
		const next = trigger.get('button')

		expect(wrapper.get('[data-tooltip]').attributes('data-text')).toBe(
			'Complete this lesson to move to the next'
		)
		expect(trigger.attributes('tabindex')).toBe('0')
		expect(next.attributes('disabled')).toBeDefined()
		expect(next.find('.lucide-lock').exists()).toBe(true)
		const reason = wrapper.get(`#${trigger.attributes('aria-describedby')}`)
		expect(reason.text()).toBe('Complete this lesson to move to the next')

		await next.trigger('click')
		expect(wrapper.emitted('switch')).toBeUndefined()
	})
})
