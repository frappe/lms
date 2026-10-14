import type { LMSBatch } from '@/types/lms/LMSBatch'

// Client-side mirror of LMS Batch's mandatory fields (lms_batch.json `reqd`).
// `batch_details` is a Text Editor field, so an "empty" editor still serializes
// to markup like "<p></p>", so strip tags before treating it as filled. An
// image-only value has no text but is not empty.
type BatchFields = Pick<
	LMSBatch,
	| 'title'
	| 'start_date'
	| 'end_date'
	| 'start_time'
	| 'end_time'
	| 'timezone'
	| 'description'
	| 'batch_details'
	| 'paid_batch'
	| 'amount'
	| 'currency'
	| 'conferencing_provider'
	| 'zoom_account'
	| 'google_meet_account'
>

// Nullable so the create form's unset dates and times pass as-is.
interface BatchValidationInput {
	doc: { [K in keyof BatchFields]: BatchFields[K] | null } | null
	instructors: readonly string[]
}

function hasText(value: string | null | undefined): boolean {
	if (!value) return false
	return (
		value.replace(/<[^>]*>/g, '').trim().length > 0 || /<img\b/i.test(value)
	)
}

// Returns a single actionable message for the first unmet requirement, or null
// when the batch can be saved. Field labels match the form labels.
export function validateBatch(input: BatchValidationInput): string | null {
	const { doc, instructors } = input
	if (!doc) return null

	const required: [string, string | null | undefined][] = [
		[__('Title'), doc.title],
		[__('Batch Start Date'), doc.start_date],
		[__('Batch End Date'), doc.end_date],
		[__('Session Start Time'), doc.start_time],
		[__('Session End Time'), doc.end_time],
		[__('Timezone'), doc.timezone],
		[__('Short Description'), doc.description],
		[__('Batch Details'), doc.batch_details],
	]
	for (const [label, value] of required) {
		if (!hasText(value)) {
			return __('Add a {0} before saving.').format(label)
		}
	}
	if (!instructors.length) {
		return __('Add at least one {0} before saving.').format(__('Instructor'))
	}

	// LMS Batch's validate_conferencing_provider, with its messages. Without it
	// a tool picked before its account fails every autosave.
	if (doc.conferencing_provider === 'Zoom' && !doc.zoom_account) {
		return __('Please select a Zoom account for this batch.')
	}
	if (doc.conferencing_provider === 'Google Meet' && !doc.google_meet_account) {
		return __('Please select a Google Meet account for this batch.')
	}

	if (!doc.paid_batch) return null
	if (!doc.currency) {
		return __('Currency is required for {0}.').format(__('paid batches'))
	}
	if (!(Number(doc.amount) > 0)) {
		return __('Amount must be a positive number for {0}.').format(
			__('paid batches')
		)
	}
	return null
}

// What other places write while this form holds the copy it loaded: the
// child tables BatchCourseForm, AssessmentForm and the timetable edit, and
// the header's Publish toggle. Saving that copy would undo them.
const FIELDS_EDITED_ELSEWHERE = new Set([
	'courses',
	'assessment',
	'timetable',
	'timetable_legends',
	'published',
])

/** What BatchForm saves: its own fields and instructors, nothing written elsewhere. */
export function batchFormPayload(
	doc: LMSBatch,
	instructors: readonly string[]
): Record<string, unknown> {
	const fields = Object.entries(doc).filter(
		([key]) => !FIELDS_EDITED_ELSEWHERE.has(key)
	)
	return {
		...Object.fromEntries(fields),
		instructors: instructors.map((instructor) => ({ instructor })),
	}
}
