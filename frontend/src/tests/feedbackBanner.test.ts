// Guards the correct/incorrect variants of the shared assessment verdict bar.
// Came with this branch's shared FeedbackBanner change.
// Added on feat/assessment-visual-redesign so quiz and exercise verdicts agree.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FeedbackBanner from '@/components/Assessment/FeedbackBanner.vue'

describe('FeedbackBanner', () => {
	it('renders the green/correct variant', () => {
		const wrapper = mount(FeedbackBanner, {
			props: { correct: true },
			slots: { default: 'Correct. Nice work.' },
		})
		expect(wrapper.classes().join(' ')).toContain('green')
		expect(wrapper.find('.lucide-check-circle').exists()).toBe(true)
		expect(wrapper.text()).toContain('Correct. Nice work.')
	})

	it('renders the red/incorrect variant', () => {
		const wrapper = mount(FeedbackBanner, {
			props: { correct: false },
			slots: { default: 'Not quite.' },
		})
		expect(wrapper.classes().join(' ')).toContain('red')
		expect(wrapper.find('.lucide-x-circle').exists()).toBe(true)
	})
})
