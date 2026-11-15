/**
 * Another user's profile arrives without `name`: a User's name is their login
 * email, and only staff are sent it. The profile tabs have to key on username.
 */
import { describe, expect, it } from 'vitest'
import { isInstructorOf } from '@/utils/instructors'

describe('isInstructorOf', () => {
	const instructors = [{ username: 'ivy', full_name: 'Ivy' }]

	it('matches an instructor on username', () => {
		expect(isInstructorOf(instructors, 'ivy')).toBe(true)
		expect(isInstructorOf(instructors, 'sam')).toBe(false)
	})

	it('never matches a missing username', () => {
		expect(isInstructorOf([{ full_name: 'No Username' }], undefined)).toBe(
			false
		)
		expect(isInstructorOf([{ username: '' }], '')).toBe(false)
	})

	it('treats no instructor list as no match', () => {
		expect(isInstructorOf(undefined, 'ivy')).toBe(false)
		expect(isInstructorOf(null, 'ivy')).toBe(false)
	})
})
