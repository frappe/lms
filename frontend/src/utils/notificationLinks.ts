export interface AssignmentSubmissionTarget {
	assignmentID: string
	submissionName: string
}

// Matched against the tail of the link rather than a fixed segment index: the
// LMS mounts under a configurable path (`lms_path`), so the number of segments
// before the interesting ones is not a constant.
const LINK = /\/assignment-submission\/([^/?#]+)\/([^/?#]+)/

export function assignmentSubmissionFromLink(
	link: string
): AssignmentSubmissionTarget | null {
	if (!link) return null
	const match = link.match(LINK)
	if (!match) return null
	return { assignmentID: match[1], submissionName: match[2] }
}
