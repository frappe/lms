import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

declare global {
	interface Window {
		__: (text: string) => string
	}
}

// LessonHelp renders user-facing copy through __(); provide the identity stub
// the other component tests use.
window.__ = (t: string) => t

// frappe-ui's module resolution doesn't work under vitest — stub Dialog to
// render its default slot whenever `open` is true (matches the beta.7 contract:
// v-model:open => `open` prop).
vi.mock('frappe-ui', () => ({
	Dialog: {
		props: ['open', 'title', 'size'],
		template: `<div v-if="open" data-testid="dialog"><slot /></div>`,
	},
}))

// VideoBlock mounts a real <video> (jsdom can't drive it); stub it to a marker
// that exposes the file it was handed.
vi.mock('@/components/VideoBlock.vue', () => ({
	default: {
		props: ['file'],
		template: `<div data-testid="video" :data-file="file" />`,
	},
}))

import LessonHelp from '@/components/LessonHelp.vue'

const mountHelp = () =>
	mount(LessonHelp, {
		props: { modelValue: true },
		global: {
			config: {
				globalProperties: {
					__: (t: string) => t,
				} as any,
			},
		},
	})

describe('LessonHelp accordion modal', () => {
	it('renders every topic title as an accordion summary', () => {
		const w = mountHelp()
		expect(w.findAll('summary')).toHaveLength(5)
		expect(w.text()).toContain('What are Instructor Notes?')
		expect(w.text()).toContain('How to add a Quiz?')
		expect(w.text()).toContain('How to remove an embed?')
	})

	it('opens the first topic by default and leaves the rest closed', () => {
		const details = mountHelp().findAll('details')
		expect(details[0].attributes('open')).toBeDefined()
		expect(details[1].attributes('open')).toBeUndefined()
	})

	it('is single-open: opening another topic closes the first', async () => {
		const details = mountHelp().findAll('details')
		await details[1].find('summary').trigger('click')
		expect(details[1].attributes('open')).toBeDefined()
		expect(details[0].attributes('open')).toBeUndefined()
	})

	it('shows a video pane for video topics and none for the text-only topic', async () => {
		const w = mountHelp()
		const details = w.findAll('details')
		// index 0 = Instructor Notes (no video), open by default
		expect(details[0].find('[data-testid="video"]').exists()).toBe(false)
		// open the Quiz topic (index 1) and assert its video file
		await details[1].find('summary').trigger('click')
		const video = w.find('[data-testid="video"]')
		expect(video.exists()).toBe(true)
		expect(video.attributes('data-file')).toBe('/assets/lms/frontend/Quiz.mp4')
	})
})
