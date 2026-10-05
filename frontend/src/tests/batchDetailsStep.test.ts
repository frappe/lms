// A saved batch counts as having details once it has an image, the one detail
// the new-batch form never asks for.
import { describe, expect, it } from 'vitest'
import { hasBatchDetails } from '@/utils/batchForm'

describe('hasBatchDetails', () => {
	// Guards: Fill in batch details ticking without an image, or not with one.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the rule.
	it.each([
		{ meta_image: '/files/batch.png', filled: true },
		{ meta_image: '', filled: false },
		{ meta_image: null, filled: false },
		{ meta_image: undefined, filled: false },
	])('image $meta_image is filled: $filled', ({ filled, ...doc }) => {
		expect(hasBatchDetails(doc)).toBe(filled)
	})

	// Guards: a batch that has not loaded throwing or counting as filled.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to cover null.
	it('reads nothing as not filled', () => {
		expect(hasBatchDetails(null)).toBe(false)
	})
})
