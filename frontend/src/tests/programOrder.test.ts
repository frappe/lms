import { describe, expect, it } from 'vitest'
import { reindexProgramCourses } from '@/utils/programOrder'

describe('reindexProgramCourses', () => {
	it('persists the order already produced by vuedraggable', () => {
		const courses = [
			{ course: 'course-c', idx: 3 },
			{ course: 'course-a', idx: 1 },
			{ course: 'course-b', idx: 2 },
		]

		reindexProgramCourses(courses)

		expect(courses).toEqual([
			{ course: 'course-c', idx: 1 },
			{ course: 'course-a', idx: 2 },
			{ course: 'course-b', idx: 3 },
		])
	})

	it('does not reorder the array a second time', () => {
		const courses = [{ course: 'course-b' }, { course: 'course-a' }]

		reindexProgramCourses(courses)

		expect(courses.map((course) => course.course)).toEqual([
			'course-b',
			'course-a',
		])
	})
})
