import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import QuizStats from '@/components/Assessment/QuizStats.vue'

const render = (questions: number) =>
	mount(QuizStats, {
		props: { questions, passingPercentage: 100 },
		global: { mocks: { __: (text: string) => text } },
	})

describe('QuizStats', () => {
	it('hides the pass mark when the quiz has no questions', () => {
		expect(render(0).text()).not.toContain('Pass mark')
	})

	it('shows the pass mark when the quiz has questions', () => {
		expect(render(3).text()).toContain('Pass mark')
	})
})
