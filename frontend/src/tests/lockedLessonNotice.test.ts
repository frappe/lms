import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import LockedLessonNotice from '@/components/LockedLessonNotice.vue'

// Mirrors src/translation.js: a message carrying {0}-style placeholders returns
// a { format } object, not a string, and takes no replacement argument. A plain
// passthrough stub would let a real `__(...).format is not a function` crash
// through.
const __ = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (match, number) =>
				typeof args[number] !== 'undefined' ? String(args[number]) : match
			),
	}
}

const mountNotice = (props = {}) =>
	mount(LockedLessonNotice, {
		props,
		global: { mocks: { __ } },
	})

beforeEach(() => {
	vi.stubGlobal('__', __)
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

describe('LockedLessonNotice', () => {
	it('hides the ticking counter from assistive technology', () => {
		const wrapper = mountNotice()
		const counter = wrapper.get('.tabular-nums')

		expect(counter.attributes('aria-hidden')).toBe('true')
		expect(counter.attributes('role')).toBeUndefined()
		expect(counter.attributes('aria-live')).toBeUndefined()
		expect(counter.text()).toContain('3')
	})

	// The region must already be in the accessibility tree before it gets text:
	// content set in the same frame as the region's own insertion reads as initial
	// content, which most screen readers do not announce at all.
	it('renders the live region empty, then fills it a frame later', async () => {
		const wrapper = mountNotice()
		const status = wrapper.get('[role="status"]')

		expect(status.classes()).toContain('sr-only')

		await nextTick()
		expect(status.text()).toBe('')

		vi.advanceTimersByTime(100)
		await nextTick()
		expect(status.text()).toBe(
			'This lesson is locked. Taking you to your current lesson in 3 seconds.'
		)
	})

	it('announces the reason once, not once per second', async () => {
		const wrapper = mountNotice()
		const status = wrapper.get('[role="status"]')

		vi.advanceTimersByTime(100)
		await nextTick()
		const announced = status.text()

		vi.advanceTimersByTime(2000)
		await nextTick()
		expect(status.text()).toBe(announced)
	})

	it('carries exactly one live region', () => {
		const wrapper = mountNotice()

		expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
		expect(wrapper.findAll('[aria-live]')).toHaveLength(0)
	})

	it('emits done when the countdown reaches zero', async () => {
		const wrapper = mountNotice()

		vi.advanceTimersByTime(2000)
		expect(wrapper.emitted('done')).toBeUndefined()

		vi.advanceTimersByTime(1000)
		expect(wrapper.emitted('done')).toHaveLength(1)
	})

	it('renders no countdown and announces nothing when redirect is off', async () => {
		const wrapper = mountNotice({ redirect: false })

		expect(wrapper.find('.tabular-nums').exists()).toBe(false)
		expect(wrapper.text()).toContain('This lesson is locked')

		vi.advanceTimersByTime(1000)
		await nextTick()
		expect(wrapper.get('[role="status"]').text()).toBe('')
	})

	it('does not blame the lock for a lesson that does not exist', async () => {
		const wrapper = mountNotice({ notFound: true })

		expect(wrapper.text()).toContain('Lesson not found')
		expect(wrapper.text()).toContain(
			'There is no lesson at this address in this course.'
		)
		expect(wrapper.text()).not.toContain('This lesson is locked')

		vi.advanceTimersByTime(100)
		await nextTick()
		expect(wrapper.get('[role="status"]').text()).toBe(
			'Lesson not found. Taking you to your current lesson in 3 seconds.'
		)
	})

	it('skips the wait when the student asks to go now', async () => {
		const wrapper = mountNotice()

		await wrapper.get('button').trigger('click')
		expect(wrapper.emitted('done')).toHaveLength(1)

		// The interval has to die with it, or it fires again on a page the student
		// has already left.
		vi.advanceTimersByTime(5000)
		expect(wrapper.emitted('done')).toHaveLength(1)
	})

	it('offers no way out when there is nowhere to send the student', () => {
		const wrapper = mountNotice({ redirect: false })

		expect(wrapper.find('button').exists()).toBe(false)
	})

	it('reports the configured duration in the announcement', async () => {
		const wrapper = mountNotice({ seconds: 10 })

		vi.advanceTimersByTime(100)
		await nextTick()
		expect(wrapper.get('[role="status"]').text()).toContain('in 10 seconds')
	})
})
