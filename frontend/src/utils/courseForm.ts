import type { LMSCourse } from '@/types/lms/LMSCourse'

// Client-side mirror of LMS Course's mandatory fields (lms_course.json `reqd`).
// `description` is a Text Editor field, so an "empty" editor still serializes to
// markup like "<p></p>" — strip tags before treating it as filled.
interface CourseValidationInput {
	doc: Pick<
		LMSCourse,
		| 'title'
		| 'description'
		| 'short_introduction'
		| 'paid_course'
		| 'paid_certificate'
		| 'currency'
		| 'course_price'
	> | null
	instructors: readonly string[]
}

function hasText(value: string | null | undefined): boolean {
	if (!value) return false
	return value.replace(/<[^>]*>/g, '').trim().length > 0
}

// Returns a single actionable message for the first unmet requirement, or null
// when the course can be saved. Field labels match the form labels so the user
// can find what to fix.
export function validateCourse(input: CourseValidationInput): string | null {
	const { doc, instructors } = input
	if (!doc) return null

	if (!hasText(doc.title)) {
		return __('Add a {0} before saving.').format(__('Title'))
	}
	if (!hasText(doc.short_introduction)) {
		return __('Add a {0} before saving.').format(__('Short Introduction'))
	}
	if (!hasText(doc.description)) {
		return __('Add a {0} before saving.').format(__('Description'))
	}
	if (!instructors.length) {
		return __('Add at least one {0} before saving.').format(__('Instructor'))
	}

	if (!doc.paid_course && !doc.paid_certificate) return null

	const subject = doc.paid_course ? __('paid courses') : __('paid certificates')
	if (!doc.currency) {
		return __('Currency is required for {0}.').format(subject)
	}
	if (!(Number(doc.course_price) > 0)) {
		return __('Price must be a positive number for {0}.').format(subject)
	}
	return null
}
