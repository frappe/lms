import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

const mobile = ref(false)
vi.mock('@/utils/composables', () => ({
	useScreenSize: () => ({ isMobile: mobile }),
}))

const __ = (message: string) => message
vi.stubGlobal('__', __)
if (!(String.prototype as { format?: unknown }).format) {
	Object.defineProperty(String.prototype, 'format', {
		value(this: string, ...args: unknown[]) {
			return this.replace(/{(\d+)}/g, (_, i) => String(args[Number(i)]))
		},
	})
}

import LessonTitle from '@/components/LessonTitle.vue'
import { lessonKindLabel } from '@/utils/lessonKind'

const mountTitle = (props: Record<string, unknown> = {}) =>
	mount(LessonTitle, {
		props: { title: 'Certification', index: 9, total: 9, ...props },
		global: { mocks: { __ } },
	})

const eyebrow = (wrapper: ReturnType<typeof mountTitle>) =>
	wrapper.find('[data-testid="lesson-eyebrow"]')

describe('lessonKindLabel', () => {
	it.each([
		['icon-youtube', 'Video'],
		['icon-quiz', 'Quiz'],
		['icon-assignment', 'Assignment'],
		['icon-code', 'Programming exercise'],
		['icon-list', 'Reading'],
		['icon-unknown', ''],
		[undefined, ''],
	])('labels %s as %j', (icon, label) => {
		expect(lessonKindLabel(icon)).toBe(label)
	})
})

describe('LessonTitle', () => {
	it('names the kind and the position across the course', () => {
		mobile.value = false
		const wrapper = mountTitle({ icon: 'icon-assignment' })
		const parts = eyebrow(wrapper)
			.findAll('span')
			.map((span) => span.text())
		expect(parts).toEqual(['Assignment', '·', 'Lesson 9 of 9'])
		expect(eyebrow(wrapper).find('[aria-hidden="true"]').text()).toBe('·')
	})

	it('drops the position until the outline places the lesson', () => {
		const wrapper = mountTitle({ icon: 'icon-quiz', index: 0, total: 0 })
		expect(eyebrow(wrapper).text()).toBe('Quiz')
	})

	it('drops the kind when the icon is unknown', () => {
		const wrapper = mountTitle({ icon: null, index: 2, total: 5 })
		expect(eyebrow(wrapper).text()).toBe('Lesson 2 of 5')
	})

	it('hides the eyebrow when there is nothing to say', () => {
		const wrapper = mountTitle({ icon: null, index: 0, total: 0 })
		expect(eyebrow(wrapper).exists()).toBe(false)
	})

	it('shows a modest one-line title on desktop', () => {
		mobile.value = false
		const h1 = mountTitle().find('h1')
		expect(h1.text()).toBe('Certification')
		expect(h1.classes()).toEqual(
			expect.arrayContaining([
				'truncate',
				'text-xl-semibold',
				'text-ink-gray-9',
			])
		)
	})

	it('keeps only the kind on mobile, where the header and pager say the rest', () => {
		mobile.value = true
		const wrapper = mountTitle({ icon: 'icon-youtube' })
		expect(wrapper.find('h1').classes()).toEqual(['sr-only'])
		expect(eyebrow(wrapper).text()).toBe('Video')
		mobile.value = false
	})
})
