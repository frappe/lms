// Everything the authoring UI needs about one question: the four author-facing
// types and how they map onto the backend's three `type` values plus
// `multiple`, and the mandatory-field rule.

// `__` is a global set by the translation plugin at app init, and this module
// is evaluated at import time, which can run first. Resolve lazily with a
// raw-string fallback.
const __ = (text) => (window.__ ? window.__(text) : text)

export const MAX_OPTIONS = 10

export const QUESTION_TYPES = [
	{
		value: 'single',
		get label() {
			return __('Single choice')
		},
		get description() {
			return __('Choices · single answer')
		},
		icon: 'lucide-circle-dot',
	},
	{
		value: 'multiple',
		get label() {
			return __('Multiple choice')
		},
		get description() {
			return __('Choices · multiple answers')
		},
		icon: 'lucide-square-check',
	},
	{
		value: 'user_input',
		get label() {
			return __('User input')
		},
		get description() {
			return __('Auto-graded')
		},
		icon: 'lucide-text-cursor-input',
	},
	{
		value: 'open_ended',
		get label() {
			return __('Open ended')
		},
		get description() {
			return __('Manually graded')
		},
		icon: 'lucide-align-left',
	},
]

// A fixed object, not QUESTION_TYPES[0], so uiTypeMeta always has a label and icon
// to return even for a value that is not in the list.
const DEFAULT_TYPE_META = {
	get label() {
		return __('Single choice')
	},
	icon: 'lucide-circle-dot',
}

// True when rich-text HTML carries anything a learner would see: text, or an embedded
// image, video or audio. Tags alone are not content, but a question whose whole body is
// a pasted diagram is, and stripping every tag before the test rejected it outright.
const EMBEDDED_MEDIA = /<(img|video|audio|iframe|embed|object)\b/i

export function hasContent(html) {
	if (!html) return false
	if (EMBEDDED_MEDIA.test(html)) return true
	return (
		html
			.replace(/<[^>]*>/g, '')
			.replace(/&nbsp;/g, ' ')
			.trim().length > 0
	)
}

// The empty option/answer skeleton. Assigning it wipes a stale question's fields
// rather than leaving whichever ones the last question happened to fill.
export const blankOptionFields = () => {
	const fields = {}
	for (let i = 1; i <= MAX_OPTIONS; i++) {
		fields[`option_${i}`] = null
		fields[`is_correct_${i}`] = 0
		fields[`explanation_${i}`] = null
		fields[`possibility_${i}`] = null
	}
	return fields
}

// Two whole strings, one per grammatical number, so a translator can reach both.
export const marksLabel = (n) =>
	Number(n) === 1 ? __('1 mark') : __('{0} marks').format(n)

export function toUiType(question) {
	if (question?.type === 'User Input') return 'user_input'
	if (question?.type === 'Open Ended') return 'open_ended'
	return question?.multiple ? 'multiple' : 'single'
}

// The label and icon for one ui type. The card and the editor each held their own
// `QUESTION_TYPES.find(...) || QUESTION_TYPES[0]`.
export function uiTypeMeta(uiType) {
	return QUESTION_TYPES.find((t) => t.value === uiType) ?? DEFAULT_TYPE_META
}

// The label and icon for a saved question's (type, multiple) pair. Shared by
// the Questions list page and the quiz's question bank panel.
export function questionTypeMeta(question) {
	return uiTypeMeta(toUiType(question))
}

export function toBackendType(uiValue) {
	switch (uiValue) {
		case 'multiple':
			return { type: 'Choices', multiple: 1 }
		case 'user_input':
			return { type: 'User Input', multiple: 0 }
		case 'open_ended':
			return { type: 'Open Ended', multiple: 0 }
		case 'single':
		default:
			return { type: 'Choices', multiple: 0 }
	}
}

export function isChoice(uiValue) {
	return uiValue === 'single' || uiValue === 'multiple'
}

// The backend rejects a quiz that mixes Open Ended with any other type (LMS
// Quiz's validate_open_ended_questions). Once a quiz has one, every question
// added afterward must also be Open Ended, or the very next save throws.
export function nextQuestionUiType(existingRows) {
	const hasOpenEnded = existingRows.some(
		(row) => toUiType(row) === 'open_ended'
	)
	return hasOpenEnded ? 'open_ended' : 'single'
}

// Which types one card may still offer, given the same mixing rule. Only the
// OTHER rows constrain it: a quiz of one question is always free, because
// re-typing the single row it has cannot produce a mix.
export function allowedUiTypesFor(rows, editingRowName) {
	const values = QUESTION_TYPES.map((t) => t.value)
	const others = (rows || []).filter((row) => row?.name !== editingRowName)
	if (!others.length) return values
	const hasOpenEnded = others.some((row) => toUiType(row) === 'open_ended')
	if (hasOpenEnded) return ['open_ended']
	return values.filter((value) => value !== 'open_ended')
}

// The backend `type` values a question may have to be addable to `rows`. The bank
// filters on that column, and an unfiltered bank stages a row that makes every
// later save fail.
export function allowedQuestionTypesFor(rows) {
	return [
		...new Set(
			allowedUiTypesFor(rows, null).map(
				(value) => toBackendType(value).type
			)
		),
	]
}

const filled = (value) => Boolean(value && String(value).trim())

// How many of each answer field a question must have before it can be saved. The
// authoring UI reads these to decide which rows carry a required marker and which
// may be removed, so the shape on screen follows the rule rather than restating it.
export const REQUIRED_OPTIONS = 2
export const REQUIRED_POSSIBILITIES = 1

// option_1 and option_2 by name, not any two: validate_minimum_options names those
// two fields, so a question filled from option_2 down would pass a count-based test
// here and throw on save.
export const hasRequiredOptions = (question) =>
	Array.from({ length: REQUIRED_OPTIONS }, (_, i) =>
		filled(question?.[`option_${i + 1}`])
	).every(Boolean)

export const countCorrectOptions = (question) =>
	Array.from({ length: MAX_OPTIONS }, (_, i) =>
		Boolean(question?.[`is_correct_${i + 1}`])
	).filter(Boolean).length

// validate_correct_options re-derives `multiple` from this count, so one correct
// answer saves a Multiple choice question as Single and the type changes under the
// author on the next reload.
export const hasRequiredCorrectOptions = (question, uiType) =>
	countCorrectOptions(question) >= (uiType === 'multiple' ? 2 : 1)

export const hasRequiredPossibilities = (question) =>
	Array.from({ length: MAX_OPTIONS }, (_, i) =>
		filled(question?.[`possibility_${i + 1}`])
	).filter(Boolean).length >= REQUIRED_POSSIBILITIES

// The mandatory-field rule for one question, shared by the card in a quiz and
// the dialog over the Questions list, so the two cannot disagree about what
// Save allows. The form marks fields red from the same predicates.
export const isQuestionValid = (question, uiType) => {
	if (!question) return false
	if (!hasContent(question.question)) return false

	if (isChoice(uiType))
		return (
			hasRequiredOptions(question) &&
			hasRequiredCorrectOptions(question, uiType)
		)

	if (uiType === 'user_input') return hasRequiredPossibilities(question)

	// open_ended: the question text is the only requirement.
	return true
}
