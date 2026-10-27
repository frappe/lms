// Guards reading an assignment-submission notification link back into a route.
// Came with this branch's move of assignment submissions under /assignments.
// Added on feat/assessment-visual-redesign to keep old server links opening.
import { describe, expect, it } from 'vitest'
import { assignmentSubmissionFromLink } from '@/utils/notificationLinks'

describe('reading an assignment-submission notification link', () => {
	it('reads the path shape the server writes', () => {
		expect(
			assignmentSubmissionFromLink('/lms/assignment-submission/ASG-1/SUB-1')
		).toEqual({ assignmentID: 'ASG-1', submissionName: 'SUB-1' })
	})

	// The number of segments ahead of the interesting ones is not a constant:
	// the LMS mounts under a configurable `lms_path`.
	it('honours a non-default lms path', () => {
		expect(
			assignmentSubmissionFromLink('/learn/assignment-submission/ASG-1/SUB-1')
		).toEqual({ assignmentID: 'ASG-1', submissionName: 'SUB-1' })
	})

	it('returns null for anything else', () => {
		expect(assignmentSubmissionFromLink('/lms/courses/COURSE-1')).toBeNull()
		expect(assignmentSubmissionFromLink('')).toBeNull()
	})
})
