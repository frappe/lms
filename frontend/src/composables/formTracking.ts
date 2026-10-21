/**
 * Telemetry helpers shared by the New Course and New Batch forms.
 *
 * Where a form was opened from: the opener sets it just before navigating and
 * the form reads it once on mount, so a reload or a pasted link reports
 * 'direct'.
 */
export type FormSource =
	| 'header_button'
	| 'onboarding'
	| 'admin_home'
	| 'course_editor'
	| 'course_editor_empty_state'
	| 'direct'

let pending: FormSource | null = null

export function setFormSource(source: FormSource) {
	pending = source
}

export function takeFormSource(): FormSource {
	const source = pending ?? 'direct'
	pending = null
	return source
}

// An empty editor still holds markup like "<p></p>", so text is checked
// without its tags.
const isFilled = (value: unknown) => {
	if (Array.isArray(value)) return value.length > 0
	if (typeof value === 'string')
		return value.replace(/<[^>]*>/g, '').trim() !== ''
	return Boolean(value)
}

/** The names of the fields that hold something, to see where people stop. */
export function filledFields(doc: Record<string, unknown>): string[] {
	return Object.entries(doc)
		.filter(([, value]) => isFilled(value))
		.map(([field]) => field)
}
