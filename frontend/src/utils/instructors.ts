import type { CourseInstructorInfo } from '@/types'

// Instructors are matched on username: their `name` is a login email, sent only
// to the instructor themselves.
export const isInstructorOf = (
	instructors: CourseInstructorInfo[] | null | undefined,
	username: unknown
): boolean =>
	typeof username === 'string' &&
	username !== '' &&
	(instructors ?? []).some((instructor) => instructor.username === username)
