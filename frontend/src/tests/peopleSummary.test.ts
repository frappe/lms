// Guards a picker of people collapsing to "N selected", which says nothing about
// who is chosen. Added on batch-instructor-names for the batch form's instructors.
import { describe, expect, it } from 'vitest'
import { summarisePeople } from '@/utils/peopleSummary'

describe('summarisePeople', () => {
	it('names one person by first name', () => {
		expect(summarisePeople(['Dharmesh Shah'])).toBe('Dharmesh')
	})

	it('joins two with "and"', () => {
		expect(summarisePeople(['Dharmesh Shah', 'Ashley Ippolito'])).toBe(
			'Dharmesh and Ashley'
		)
	})

	it('lists three in full', () => {
		expect(
			summarisePeople(['Dharmesh Shah', 'Ashley Ippolito', 'Sayali Yewale'])
		).toBe('Dharmesh, Ashley and Sayali')
	})

	it('names the first two and "others" past three', () => {
		expect(
			summarisePeople([
				'Dharmesh Shah',
				'Ashley Ippolito',
				'Sayali Yewale',
				'Jannat Patel',
			])
		).toBe('Dharmesh, Ashley and others')
	})

	it('falls back to the part of an email before the @', () => {
		expect(summarisePeople(['ashley@example.com'])).toBe('ashley')
	})

	it('is empty when no one is chosen', () => {
		expect(summarisePeople([])).toBe('')
	})
})
