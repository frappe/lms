import { describe, expect, it } from 'vitest'
import { withoutSelectedRows } from '@/utils/programSelection'

describe('withoutSelectedRows', () => {
	it('removes a persisted course selected by its course key', () => {
		const rows = [
			{ name: 'child-row-1', course: 'course-a' },
			{ name: 'child-row-2', course: 'course-b' },
		]

		expect(withoutSelectedRows(rows, ['course-a'], ['name', 'course'])).toEqual([
			{ name: 'child-row-2', course: 'course-b' },
		])
	})

	it('removes a persisted member selected by its member key', () => {
		const rows = [
			{ name: 'child-row-1', member: 'one@example.com' },
			{ name: 'child-row-2', member: 'two@example.com' },
		]

		expect(
			withoutSelectedRows(rows, ['one@example.com'], ['name', 'member']),
		).toEqual([{ name: 'child-row-2', member: 'two@example.com' }])
	})

	it('also accepts the child row name as the selection identity', () => {
		const rows = [{ name: 'child-row-1', course: 'course-a' }]

		expect(
			withoutSelectedRows(rows, ['child-row-1'], ['name', 'course']),
		).toEqual([])
	})
})
