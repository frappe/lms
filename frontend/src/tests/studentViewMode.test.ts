import { describe, expect, it } from 'vitest'
import { studentViewMode, studentViewQuery } from '@/composables/useStudentView'

describe('the student view mode in the URL', () => {
	it('reads 1 as enrolled, not-enrolled as a visitor, and anything else as no preview', () => {
		expect(studentViewMode('1')).toBe('enrolled')
		expect(studentViewMode(1)).toBe('enrolled')
		expect(studentViewMode('not-enrolled')).toBe('not-enrolled')
		expect(studentViewMode('0')).toBeNull()
		expect(studentViewMode(undefined)).toBeNull()
	})

	it('writes each mode back so lesson hops keep it', () => {
		expect(studentViewQuery('enrolled')).toEqual({ studentView: 1 })
		expect(studentViewQuery('not-enrolled')).toEqual({
			studentView: 'not-enrolled',
		})
		expect(studentViewQuery(null)).toBeUndefined()
	})
})
