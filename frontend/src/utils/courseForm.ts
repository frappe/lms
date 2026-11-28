import type { LMSCourse } from '@/types/lms/LMSCourse'

// Client-side mirror of LMS Course's mandatory fields (lms_course.json `reqd`).
// `description` is a Text Editor field, so an "empty" editor still serializes to
// markup like "<p></p>", so strip tags; an image-only one still counts.
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
	return (
		value.replace(/<[^>]*>/g, '').trim().length > 0 || /<img\b/i.test(value)
	)
}

export interface MissingField {
	key: 'title' | 'short_introduction' | 'description' | 'instructors' | 'price'
	label: string
}

// Every unmet requirement, so the Save tooltip can name them all and each
// inline field can ring itself.
export function missingCourseFields(
	input: CourseValidationInput
): MissingField[] {
	const { doc, instructors } = input
	if (!doc) return []
	const missing: MissingField[] = []
	if (!hasText(doc.title)) missing.push({ key: 'title', label: __('a title') })
	if (!hasText(doc.short_introduction)) {
		missing.push({ key: 'short_introduction', label: __('an introduction') })
	}
	if (!hasText(doc.description)) {
		missing.push({ key: 'description', label: __('a description') })
	}
	if (!instructors.length) {
		missing.push({ key: 'instructors', label: __('an instructor') })
	}
	const charges = doc.paid_course || doc.paid_certificate
	if (charges && (!doc.currency || !(Number(doc.course_price) > 0))) {
		missing.push({ key: 'price', label: __('a price') })
	}
	return missing
}

/** "a", "a and b", "a, b and c". */
export function joinLabels(labels: string[]): string {
	if (labels.length < 2) return labels[0] ?? ''
	return __('{0} and {1}').format(
		labels.slice(0, -1).join(', '),
		labels[labels.length - 1]
	)
}
