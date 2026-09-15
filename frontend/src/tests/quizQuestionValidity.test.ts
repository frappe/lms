import { describe, expect, it } from 'vitest'
import { isQuestionValid } from '@/utils/quizQuestion'

// validate_correct_options re-derives `multiple` from how many options are
// correct, so a Multiple choice question with one correct answer is stored as
// Single and the learner gets radios.
describe('isQuestionValid: what the server would rewrite', () => {
	const choices = (over: Record<string, unknown> = {}) => ({
		question: '<p>What is 2+2?</p>',
		option_1: 'four',
		option_2: 'five',
		is_correct_1: 1,
		...over,
	})

	it('refuses a multiple choice question until two answers are correct', () => {
		expect(isQuestionValid(choices(), 'multiple')).toBe(false)
		expect(isQuestionValid(choices({ is_correct_2: 1 }), 'multiple')).toBe(true)
	})
})
