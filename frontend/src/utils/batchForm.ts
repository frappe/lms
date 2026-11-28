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

export interface MissingBatchField {
	key: string
	label: string
}

/** Every empty required field, keyed the way the overview rings them. */
export function missingBatchFields(
	input: BatchValidationInput
): MissingBatchField[] {
	const { doc, instructors } = input
	if (!doc) return []
	const required: [string, string, unknown][] = [
		['title', __('title'), doc.title],
		['instructors', __('instructors'), instructors.length ? 'set' : ''],
		['description', __('short description'), doc.description],
		['dates', __('dates'), doc.start_date && doc.end_date],
		['times', __('class times'), doc.start_time && doc.end_time],
		['timezone', __('timezone'), doc.timezone],
		['batch_details', __('batch details'), doc.batch_details],
	]
	if (doc.paid_batch) {
		required.push(['currency', __('currency'), doc.currency])
		required.push(['amount', __('price'), Number(doc.amount) > 0 ? 'set' : ''])
	}
	return required
		.filter(([, , value]) => !hasText(value ? String(value) : ''))
		.map(([key, label]) => ({ key, label }))
}
