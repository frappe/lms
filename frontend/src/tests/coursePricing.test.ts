/**
 * When a saved course counts as priced, which completes the publish flow's
 * "Set pricing" step.
 */
import { describe, expect, it } from 'vitest'
import { isPricedCourse } from '@/utils/courseForm'

describe('isPricedCourse', () => {
	// Guards: Set pricing ticking for a free or zero-price course. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// pin the rule.
	it.each([
		{ paid_course: 1, course_price: 499, priced: true },
		{ paid_course: true, course_price: 1, priced: true },
		{ paid_course: 1, course_price: 0, priced: false },
		{ paid_course: 0, course_price: 499, priced: false },
		{ paid_course: false, course_price: null, priced: false },
		{ paid_course: 1, course_price: undefined, priced: false },
	])(
		'paid $paid_course at $course_price is priced: $priced',
		({ priced, ...doc }) => {
			expect(isPricedCourse(doc)).toBe(priced)
		}
	)

	// Guards: a course that has not loaded throwing or counting as priced.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to cover null.
	it('reads nothing as unpriced', () => {
		expect(isPricedCourse(null)).toBe(false)
	})
})
